/**
 * Routes Google OAuth per-user (Google Ads).
 *
 * Mount strategy identique à Facebook :
 *  - `publicGoogleRouter` (callback) → AVANT requireAuth (Google redirige le
 *    navigateur sans header Clerk). Le state HMAC porte le userId.
 *  - `googleRouter` (start) → APRÈS requireAuth.
 */
import { Router, type IRouter } from "express";
import type { AuthedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  isGoogleOAuthConfigured,
  resolveGoogleRedirectUri,
  signGoogleState,
  verifyGoogleState,
} from "../lib/google-oauth";
import { upsertUserIntegration } from "../lib/user-integrations";
import { listAccessibleCustomers } from "../lib/google-ads";

function uid(req: unknown): string {
  return (req as AuthedRequest).userId;
}

// ── PUBLIC (callback) ────────────────────────────────────────────────────

export const publicGoogleRouter: IRouter = Router();

const CALLBACK_FR: Record<string, string> = {
  ok: "ok",
  missing_params: "Paramètres manquants dans la redirection Google.",
  invalid_state: "Lien de connexion expiré ou déjà utilisé. Relance la connexion.",
  exchange_failed: "Échec de l'échange du jeton avec Google. Réessaie.",
  user_cancelled: "Connexion annulée côté Google.",
  no_refresh_token:
    "Google n'a pas renvoyé de jeton réutilisable. Va dans tes accès Google → Sécurité → Apps tierces, supprime GrowIQ, puis reconnecte.",
};

publicGoogleRouter.get("/auth/google/callback", async (req, res) => {
  const code = typeof req.query["code"] === "string" ? req.query["code"] : null;
  const state = typeof req.query["state"] === "string" ? req.query["state"] : null;
  const errorParam = typeof req.query["error"] === "string" ? req.query["error"] : null;

  const back = (key: string) => {
    const msg = CALLBACK_FR[key] ?? "Erreur Google inconnue.";
    res.redirect(`/app/integrations?google=${encodeURIComponent(msg)}`);
  };

  if (errorParam) {
    logger.warn({ errorParam }, "Google callback returned error");
    return back(errorParam === "access_denied" ? "user_cancelled" : "exchange_failed");
  }
  if (!code || !state) return back("missing_params");

  const verified = verifyGoogleState(state);
  if (!verified) return back("invalid_state");

  try {
    const redirectUri = resolveGoogleRedirectUri(req);
    const tokens = await exchangeGoogleCode(code, redirectUri);

    // Sans refresh_token on ne peut rien faire à long terme (l'access_token
    // expire en 1h). C'est le cas si l'user avait déjà autorisé l'app et
    // qu'on n'a pas forcé prompt=consent — on l'a forcé, mais filet de sécurité.
    if (!tokens.refresh_token) {
      logger.warn({ userId: verified.userId }, "Google OAuth missing refresh_token");
      return back("no_refresh_token");
    }

    const me = await fetchGoogleUserInfo(tokens.access_token).catch(() => null);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Auto-detect Google Ads customer ID(s) for this user
    const developerToken = process.env["GOOGLE_ADS_DEVELOPER_TOKEN"];
    const clientId = process.env["GOOGLE_ADS_CLIENT_ID"] || process.env["GOOGLE_OAUTH_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_ADS_CLIENT_SECRET"] || process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
    let googleAdsCustomerId: string | undefined;
    if (developerToken && clientId && clientSecret && tokens.refresh_token) {
      const custResult = await listAccessibleCustomers({
        refreshToken: tokens.refresh_token,
        developerToken,
        clientId,
        clientSecret,
      } as any).catch(() => null);
      if (custResult?.ok && custResult.customerIds.length > 0) {
        googleAdsCustomerId = custResult.customerIds[0];
        logger.info({ userId: verified.userId, customerIds: custResult.customerIds }, "Google Ads customer IDs detected");
      }
    }

    await upsertUserIntegration({
      userId: verified.userId,
      platform: "google_ads",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scopes: tokens.scope ?? null,
      accountId: me?.sub ?? null,
      accountLabel: me?.email ?? null,
      metadata: {
        googleAdsEmail: me?.email,
        displayName: me?.name,
        displayAvatarUrl: me?.picture,
        ...(googleAdsCustomerId ? { googleAdsCustomerId } : {}),
      },
      status: "active",
      lastVerifiedAt: new Date(),
    });

    return back("ok");
  } catch (err) {
    logger.error({ err }, "Google callback exchange failed");
    return back("exchange_failed");
  }
});

// ── AUTHED ───────────────────────────────────────────────────────────────

const googleRouter: IRouter = Router();
export default googleRouter;

googleRouter.get("/auth/google/start", async (req, res) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      res.status(503).json({
        error:
          "Google OAuth pas encore configuré côté serveur (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).",
      });
      return;
    }
    const userId = uid(req);
    const state = signGoogleState(userId);
    const redirectUri = resolveGoogleRedirectUri(req);
    const url = buildGoogleAuthorizeUrl(state, redirectUri);
    req.log.info({ userId, redirectUri, urlLength: url.length, urlStart: url.slice(0, 60) }, "google_start_ok");
    res.json({ url, redirectUri });
  } catch (err) {
    req.log.error({ err: err instanceof Error ? { message: err.message, stack: err.stack } : err }, "google_start_failed");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur interne au démarrage de l'OAuth Google.",
    });
  }
});
