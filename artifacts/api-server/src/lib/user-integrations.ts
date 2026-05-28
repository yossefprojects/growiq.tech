/**
 * Helpers DB pour la table `user_integrations`.
 *
 * Une connexion par (userId, platform). Upsert atomique sur l'index unique
 * pour éviter les race conditions entre deux callbacks OAuth concurrents.
 */
import { and, eq } from "drizzle-orm";
import {
  db,
  userIntegrations,
  type UserIntegration,
  type UserIntegrationMetadata,
  type UserIntegrationPlatform,
  type UserIntegrationStatus,
} from "@workspace/db";

export type UpsertUserIntegrationInput = {
  userId: string;
  platform: UserIntegrationPlatform;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string | null;
  accountId?: string | null;
  accountLabel?: string | null;
  metadata?: UserIntegrationMetadata;
  status?: UserIntegrationStatus;
  lastVerifiedAt?: Date | null;
};

export async function upsertUserIntegration(
  input: UpsertUserIntegrationInput,
): Promise<UserIntegration> {
  const values = {
    userId: input.userId,
    platform: input.platform,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
    expiresAt: input.expiresAt ?? null,
    scopes: input.scopes ?? null,
    accountId: input.accountId ?? null,
    accountLabel: input.accountLabel ?? null,
    metadata: input.metadata ?? {},
    status: input.status ?? "active",
    lastVerifiedAt: input.lastVerifiedAt ?? new Date(),
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(userIntegrations)
    .values(values)
    .onConflictDoUpdate({
      // Index unique sur (user_id, platform)
      target: [userIntegrations.userId, userIntegrations.platform],
      set: {
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        expiresAt: values.expiresAt,
        scopes: values.scopes,
        accountId: values.accountId,
        accountLabel: values.accountLabel,
        metadata: values.metadata,
        status: values.status,
        lastVerifiedAt: values.lastVerifiedAt,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  return row;
}

export async function getUserIntegration(
  userId: string,
  platform: UserIntegrationPlatform,
): Promise<UserIntegration | null> {
  const [row] = await db
    .select()
    .from(userIntegrations)
    .where(
      and(eq(userIntegrations.userId, userId), eq(userIntegrations.platform, platform)),
    )
    .limit(1);
  return row ?? null;
}

export async function listUserIntegrations(userId: string): Promise<UserIntegration[]> {
  return db
    .select()
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId));
}

export async function deleteUserIntegration(
  userId: string,
  platform: UserIntegrationPlatform,
): Promise<void> {
  await db
    .delete(userIntegrations)
    .where(
      and(eq(userIntegrations.userId, userId), eq(userIntegrations.platform, platform)),
    );
}

export async function markIntegrationStatus(
  userId: string,
  platform: UserIntegrationPlatform,
  status: UserIntegrationStatus,
  errorMessage?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (errorMessage !== undefined) {
    const cur = await getUserIntegration(userId, platform);
    patch["metadata"] = { ...(cur?.metadata ?? {}), lastErrorMessage: errorMessage };
  }
  await db
    .update(userIntegrations)
    .set(patch)
    .where(
      and(eq(userIntegrations.userId, userId), eq(userIntegrations.platform, platform)),
    );
}

export function isIntegrationUsable(c: UserIntegration | null): c is UserIntegration {
  if (!c) return false;
  if (c.status !== "active") return false;
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return false;
  return true;
}
