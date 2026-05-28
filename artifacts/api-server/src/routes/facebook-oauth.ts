/**
 * Routes Facebook OAuth per-user.
 *
 * Mount strategy (cf. linkedin.ts) :
 *  - `publicFacebookRouter` (callback) → AVANT requireAuth car Facebook redirige
 *    le navigateur sans header Clerk. Le state HMAC-signé porte le userId.
 *  - `facebookRouter` (start, status, disconnect) → APRÈS requireAuth.
 */
import { Router, type IRouter } from "express";
import type { AuthedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  buildFacebookAuthorizeUrl,
  exchangeFacebookCode,
  exchangeForLongLivedToken,
  fetchFacebookAdAccounts,
  fetchFacebookMe,
  fetchFacebookPages,
  isFacebookOAuthConfigured,
  resolveFacebookRedirectUri,
  signFacebookState,
  verifyFacebookState,
} from "../lib/facebook-oauth";
import {
  deleteUserIntegration,
  getUserIntegration,
  upsertUserIntegration,
} from "../lib/user-integrations";

function uid(req: unknown): string {
  return (req as AuthedRequest).userId;
}

// ── PUBLIC (callback) ────────────────────────────────────────────────────

export const publicFacebookRouter: IRouter = Router();

const CALLBACK_FR: Record<string, string> = {
  ok: "ok",
  missing_params: "Paramètres manquants dans la redirection Facebook.",
  invalid_state: "Lien de connexion expiré ou déjà utilisé. Relance la connexion.",
  exchange_failed: "Échec de l'échange du jeton avec Facebook. Réessaie.",
  user_cancelled: "Connexion annulée côté Facebook.",
  no_pages: "Aucune page Facebook trouvée sur ce compte. Crée d'abord une page Pro.",
};

publicFacebookRouter.get("/auth/facebook/callback", async (req, res) => {
  const code = typeof req.query["code"] === "string" ? req.query["code"] : null;
  const state = typeof req.query["state"] === "string" ? req.query["state"] : null;
  const errorParam = typeof req.query["error"] === "string" ? req.query["error"] : null;
  const errorReason = typeof req.query["error_reason"] === "string" ? req.query["error_reason"] : null;

  const back = (key: string) => {
    const msg = CALLBACK_FR[key] ?? "Erreur Facebook inconnue.";
    res.redirect(`/app/integrations?facebook=${encodeURIComponent(msg)}`);
  };

  if (errorParam) {
    logger.warn({ errorParam, errorReason }, "Facebook callback returned error");
    return back(errorReason === "user_denied" ? "user_cancelled" : "exchange_failed");
  }
  if (!code || !state) return back("missing_params");

  const verified = verifyFacebookState(state);
  if (!verified) return back("invalid_state");

  try {
    const redirectUri = resolveFacebookRedirectUri(req);
    const shortToken = await exchangeFacebookCode(code, redirectUri);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);

    const me = await fetchFacebookMe(longToken.access_token);
    const pages = await fetchFacebookPages(longToken.access_token);
    if (pages.length === 0) {
      return back("no_pages");
    }

    // MVP : on prend la 1ère page. L'utilisateur pourra changer plus tard via
    // metadata.selectedFacebookPageId (UI à venir si plusieurs pages).
    const first = pages[0];
    const ig = first.instagram_business_account;

    // Récupère aussi les comptes publicitaires Meta (ads_management). Non-fatal :
    // si l'user a refusé le scope ou n'a pas de compte pub, on continue.
    const adAccounts = await fetchFacebookAdAccounts(longToken.access_token);
    const firstActiveAd = adAccounts.find((a) => a.account_status === 1) ?? adAccounts[0];

    const expiresAt = longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000)
      : null;

    await upsertUserIntegration({
      userId: verified.userId,
      platform: "meta",
      accessToken: longToken.access_token,
      expiresAt,
      scopes: undefined,
      accountId: first.id,
      accountLabel: first.name,
      metadata: {
        facebookPages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          accessToken: p.access_token,
          category: p.category,
        })),
        selectedFacebookPageId: first.id,
        instagramAccount: ig ? { id: ig.id, username: ig.username } : undefined,
        displayName: me.name,
        metaAdAccounts: adAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          accountStatus: a.account_status,
          currency: a.currency,
        })),
        selectedMetaAdAccountId: firstActiveAd?.id,
      },
      status: "active",
      lastVerifiedAt: new Date(),
    });

    return back("ok");
  } catch (err) {
    logger.error({ err }, "Facebook callback exchange failed");
    return back("exchange_failed");
  }
});

// ── AUTHED ───────────────────────────────────────────────────────────────

const facebookRouter: IRouter = Router();
export default facebookRouter;

facebookRouter.get("/auth/facebook/start", async (req, res) => {
  if (!isFacebookOAuthConfigured()) {
    res.status(503).json({
      error: "Facebook OAuth pas encore configuré côté serveur (META_APP_ID / META_APP_SECRET).",
    });
    return;
  }
  const state = signFacebookState(uid(req));
  const redirectUri = resolveFacebookRedirectUri(req);
  const url = buildFacebookAuthorizeUrl(state, redirectUri);
  res.json({ url, redirectUri });
});

facebookRouter.get("/facebook/status", async (req, res) => {
  const conn = await getUserIntegration(uid(req), "meta");
  if (!conn) {
    res.json({ configured: isFacebookOAuthConfigured(), connected: false });
    return;
  }
  const expired = !!(conn.expiresAt && conn.expiresAt.getTime() < Date.now());
  res.json({
    configured: isFacebookOAuthConfigured(),
    connected: !expired && conn.status === "active",
    status: conn.status,
    expired,
    pageName: conn.accountLabel,
    pageId: conn.accountId,
    instagramUsername: conn.metadata?.instagramAccount?.username ?? null,
    hasInstagram: !!conn.metadata?.instagramAccount?.id,
    displayName: conn.metadata?.displayName ?? null,
    expiresAt: conn.expiresAt,
    lastErrorMessage: conn.metadata?.lastErrorMessage ?? null,
  });
});

facebookRouter.post("/facebook/disconnect", async (req, res) => {
  await deleteUserIntegration(uid(req), "meta");
  res.json({ ok: true });
});
