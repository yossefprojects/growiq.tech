import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  db,
  localUsers,
  conversations,
  messages,
  campaigns,
  landingPages,
  leads,
  scheduledPosts,
  agencyCampaigns,
  adCampaigns,
  businessProfiles,
} from "@workspace/db";
import { logger } from "../lib/logger";

export interface AuthedRequest extends Request {
  userId: string;
  userEmail: string | null;
  isAdmin: boolean;
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.GROWIQ_ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Resolves the Clerk userId + caches a local row in `local_users` for the
 * authenticated user. On the FIRST request from an admin, also runs a one-shot
 * backfill that claims all rows where userId IS NULL (pre-auth legacy data).
 */
async function loadLocalUser(userId: string): Promise<{
  email: string | null;
  isAdmin: boolean;
  backfillClaimed: boolean;
}> {
  let email: string | null = null;
  try {
    const u = await clerkClient.users.getUser(userId);
    email = u.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  } catch (err) {
    logger.warn({ err, userId }, "Failed to fetch Clerk user");
  }

  const admins = adminEmails();
  const isAdmin = !!email && admins.has(email);

  const [existing] = await db
    .select()
    .from(localUsers)
    .where(eq(localUsers.id, userId));

  if (!existing) {
    await db
      .insert(localUsers)
      .values({ id: userId, email, isAdmin, backfillClaimed: false })
      .onConflictDoNothing();
    return { email, isAdmin, backfillClaimed: false };
  }

  // Keep email/isAdmin in sync if env list changed
  if (existing.email !== email || existing.isAdmin !== isAdmin) {
    await db
      .update(localUsers)
      .set({ email, isAdmin, lastSeenAt: new Date() })
      .where(eq(localUsers.id, userId));
  } else {
    await db
      .update(localUsers)
      .set({ lastSeenAt: new Date() })
      .where(eq(localUsers.id, userId));
  }
  return { email, isAdmin, backfillClaimed: existing.backfillClaimed };
}

/**
 * One-shot: claim all rows whose userId IS NULL for the given admin user.
 * Idempotent via the `local_users.backfill_claimed` flag.
 */
async function runBackfillIfNeeded(userId: string, alreadyClaimed: boolean): Promise<void> {
  if (alreadyClaimed) return;
  try {
    await db.transaction(async (tx) => {
      const tables = [
        conversations,
        messages,
        campaigns,
        landingPages,
        leads,
        scheduledPosts,
        agencyCampaigns,
        adCampaigns,
        businessProfiles,
      ] as const;
      for (const t of tables) {
        await tx
          .update(t as never)
          .set({ userId } as never)
          .where(isNull((t as never as { userId: typeof conversations.userId }).userId));
      }
      await tx
        .update(localUsers)
        .set({ backfillClaimed: true })
        .where(eq(localUsers.id, userId));
    });
    logger.info({ userId }, "Backfill claimed orphaned rows for admin");
  } catch (err) {
    logger.error({ err, userId }, "Backfill failed");
  }
}

/**
 * Requires an authenticated Clerk session. Attaches userId/email/isAdmin to req.
 * Also syncs the local_users cache and runs the backfill on first admin login.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Connecte-toi pour continuer." });
    return;
  }
  try {
    const local = await loadLocalUser(userId);
    if (local.isAdmin && !local.backfillClaimed) {
      await runBackfillIfNeeded(userId, false);
    }
    (req as AuthedRequest).userId = userId;
    (req as AuthedRequest).userEmail = local.email;
    (req as AuthedRequest).isAdmin = local.isAdmin;
    next();
  } catch (err) {
    logger.error({ err }, "requireAuth failed");
    res.status(500).json({ error: "Erreur d'authentification." });
  }
};

/**
 * Closed beta gate: must be admin (email in GROWIQ_ADMIN_EMAILS).
 * Must be used AFTER requireAuth.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const r = req as AuthedRequest;
  if (!r.userId) {
    res.status(401).json({ error: "Connecte-toi pour continuer." });
    return;
  }
  if (!r.isAdmin) {
    res.status(403).json({
      error: "GrowIQ est en bêta fermée. Demande un accès à l'équipe pour commencer.",
      code: "beta_closed",
    });
    return;
  }
  next();
};

/** Helper: get the userId from an authenticated request (typed). */
export function userIdOf(req: Request): string {
  return (req as AuthedRequest).userId;
}
