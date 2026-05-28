/**
 * Manual token entry — fallback to OAuth.
 *
 * Some users have trouble with OAuth (App Review pending, restrictive
 * browsers, dev console misconfigured). This file exposes 4 POST endpoints
 * that accept a token / id manually, verify it against the provider when
 * possible, and persist the connection just like the OAuth callback would.
 *
 *   POST /api/integrations/facebook/manual    { accessToken }
 *   POST /api/integrations/linkedin/manual    { accessToken }
 *   POST /api/integrations/meta-ads/manual    { adAccountId }   (requires FB connected)
 *   POST /api/integrations/google-ads/manual  { customerId }    (format xxx-xxx-xxxx)
 *
 * All endpoints return { ok: true, ... } on success or { ok: false, error }
 * with a human-readable French message on failure.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, linkedinConnections } from "@workspace/db";
import type { AuthedRequest } from "../middlewares/auth";
import {
  getUserIntegration,
  upsertUserIntegration,
} from "../lib/user-integrations";
import { logger } from "../lib/logger";

function uid(req: unknown): string {
  return (req as AuthedRequest).userId;
}

const router: IRouter = Router();
export default router;

// ── Helpers ───────────────────────────────────────────────────────────────

async function jsonFetch(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const r = await fetch(url, init);
    const ct = r.headers.get("content-type") ?? "";
    const body = ct.includes("application/json") ? await r.json() : await r.text();
    return { ok: r.ok, status: r.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: (err as Error).message };
  }
}

function fbErrorMessage(body: unknown): string {
  const e = (body as { error?: { message?: string; code?: number } })?.error;
  if (e?.message) return e.message;
  return typeof body === "string" ? body : "Réponse Facebook inattendue.";
}

// ── 1. Facebook + Instagram (manual access token) ────────────────────────

const fbSchema = z.object({
  accessToken: z
    .string()
    .trim()
    .min(20, "Le token semble trop court (au moins 20 caractères attendus).")
    .max(500, "Le token est anormalement long."),
});

router.post("/integrations/facebook/manual", async (req, res) => {
  const parsed = fbSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Token invalide." });
    return;
  }
  const { accessToken } = parsed.data;
  const userId = uid(req);

  // 1) Verify token: GET /me
  const me = await jsonFetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!me.ok) {
    res.status(400).json({
      ok: false,
      error: `Token Facebook invalide : ${fbErrorMessage(me.body)}`,
    });
    return;
  }
  const meData = me.body as { id: string; name?: string };

  // 2) Fetch pages + their IG business account
  const pagesResp = await jsonFetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!pagesResp.ok) {
    res.status(400).json({
      ok: false,
      error: `Impossible de lister tes pages Facebook : ${fbErrorMessage(pagesResp.body)}`,
    });
    return;
  }
  const pagesData = pagesResp.body as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      category?: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
  };
  const pages = pagesData.data ?? [];
  if (pages.length === 0) {
    res.status(400).json({
      ok: false,
      error:
        "Aucune page Facebook trouvée sur ce token. Vérifie que tu as bien coché les permissions « Pages » dans le Graph API Explorer.",
    });
    return;
  }
  const firstPage = pages[0];
  const ig = firstPage.instagram_business_account;

  await upsertUserIntegration({
    userId,
    platform: "meta",
    accessToken, // user-level token (long-lived if generated correctly)
    accountId: meData.id,
    accountLabel: firstPage.name,
    scopes: null,
    metadata: {
      displayName: meData.name,
      facebookPages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        accessToken: p.access_token,
        category: p.category,
      })),
      selectedFacebookPageId: firstPage.id,
      instagramAccount: ig ? { id: ig.id, username: ig.username } : undefined,
    },
    status: "active",
    lastVerifiedAt: new Date(),
  });

  res.json({
    ok: true,
    pageName: firstPage.name,
    pagesCount: pages.length,
    instagramUsername: ig?.username ?? null,
  });
});

// ── 2. LinkedIn (manual access token) ────────────────────────────────────

const liSchema = z.object({
  accessToken: z.string().trim().min(20).max(2000),
});

router.post("/integrations/linkedin/manual", async (req, res) => {
  const parsed = liSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Token LinkedIn invalide." });
    return;
  }
  const { accessToken } = parsed.data;
  const userId = uid(req);

  // /v2/userinfo (OpenID) — works with `openid profile email` scopes
  const info = await jsonFetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!info.ok) {
    res.status(400).json({
      ok: false,
      error:
        "Token LinkedIn invalide. Vérifie que tu as bien coché les permissions « openid », « profile » et « email » en générant ton token.",
    });
    return;
  }
  const u = info.body as {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  const personUrn = `urn:li:person:${u.sub}`;

  // Upsert via legacy linkedin_connections table (compatible with existing flow)
  await db
    .insert(linkedinConnections)
    .values({
      userId,
      accessToken,
      refreshToken: null,
      expiresAt: null,
      personUrn,
      name: u.name ?? null,
      email: u.email ?? null,
      pictureUrl: u.picture ?? null,
      scopes: "openid profile email w_member_social",
    })
    .onConflictDoUpdate({
      target: linkedinConnections.userId,
      set: {
        accessToken,
        refreshToken: null,
        expiresAt: null,
        personUrn,
        name: u.name ?? null,
        email: u.email ?? null,
        pictureUrl: u.picture ?? null,
        scopes: "openid profile email w_member_social",
        updatedAt: new Date(),
      },
    });

  res.json({ ok: true, name: u.name ?? null, email: u.email ?? null });
});

// ── 3. Meta Ads (manual ad account id, requires FB connected) ────────────

const metaAdsSchema = z.object({
  adAccountId: z
    .string()
    .trim()
    .regex(
      /^act_\d{6,20}$/,
      "Format invalide. Attendu : act_xxxxxxxxxx (commence par 'act_' suivi de chiffres).",
    ),
});

router.post("/integrations/meta-ads/manual", async (req, res) => {
  const parsed = metaAdsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "ID invalide." });
    return;
  }
  const { adAccountId } = parsed.data;
  const userId = uid(req);

  // Need an active Facebook integration to verify the ad account
  const meta = await getUserIntegration(userId, "meta");
  if (!meta || meta.status !== "active") {
    res.status(412).json({
      ok: false,
      error:
        "Connecte d'abord ton compte Facebook (page Mes outils → Facebook), puis reviens ajouter ton compte publicitaire.",
    });
    return;
  }

  // Verify the ad account exists & user has access
  const acc = await jsonFetch(
    `https://graph.facebook.com/v21.0/${adAccountId}?fields=name,currency,account_status&access_token=${encodeURIComponent(meta.accessToken)}`,
  );
  if (!acc.ok) {
    res.status(400).json({
      ok: false,
      error: `Impossible d'accéder à ce compte publicitaire : ${fbErrorMessage(acc.body)}`,
    });
    return;
  }
  const accData = acc.body as {
    id?: string;
    name: string;
    currency?: string;
    account_status?: number;
  };

  // Merge into existing meta integration metadata
  const existingAds = meta.metadata?.metaAdAccounts ?? [];
  const filteredAds = existingAds.filter((a) => a.id !== adAccountId);
  const newAds = [
    ...filteredAds,
    {
      id: adAccountId,
      name: accData.name,
      accountStatus: accData.account_status,
      currency: accData.currency,
    },
  ];

  await upsertUserIntegration({
    userId,
    platform: "meta",
    accessToken: meta.accessToken,
    refreshToken: meta.refreshToken,
    expiresAt: meta.expiresAt,
    scopes: meta.scopes,
    accountId: meta.accountId,
    accountLabel: meta.accountLabel,
    metadata: {
      ...meta.metadata,
      metaAdAccounts: newAds,
      selectedMetaAdAccountId: adAccountId,
    },
    status: "active",
    lastVerifiedAt: new Date(),
  });

  res.json({
    ok: true,
    adAccountId,
    name: accData.name,
    currency: accData.currency ?? null,
  });
});

// ── 4. Google Ads (manual customer id, no real verification) ─────────────

const googleAdsSchema = z.object({
  customerId: z
    .string()
    .trim()
    .regex(
      /^\d{3}-\d{3}-\d{4}$/,
      "Format invalide. Attendu : xxx-xxx-xxxx (10 chiffres séparés par des tirets).",
    ),
});

router.post("/integrations/google-ads/manual", async (req, res) => {
  const parsed = googleAdsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "ID invalide." });
    return;
  }
  const { customerId } = parsed.data;
  const userId = uid(req);
  const customerIdDigits = customerId.replace(/-/g, "");

  // TRADEOFF: without a Google Ads Developer Token (Basic Access in review),
  // we cannot actually call the Google Ads API to verify the customer id
  // belongs to the user. We accept the format and store it; real ad
  // operations stay gated by `apiReady` in the UI.
  const existing = await getUserIntegration(userId, "google_ads");
  await upsertUserIntegration({
    userId,
    platform: "google_ads",
    accessToken: existing?.accessToken ?? `manual:${customerIdDigits}`,
    refreshToken: existing?.refreshToken ?? null,
    expiresAt: null,
    scopes: existing?.scopes ?? null,
    accountId: customerIdDigits,
    accountLabel: customerId,
    metadata: {
      ...(existing?.metadata ?? {}),
      googleAdsCustomerId: customerIdDigits,
      googleAdsEmail: existing?.metadata?.googleAdsEmail,
    },
    status: "active",
    lastVerifiedAt: new Date(),
  });
  logger.info({ userId, customerId }, "google_ads_manual_saved");

  res.json({ ok: true, customerId });
});
