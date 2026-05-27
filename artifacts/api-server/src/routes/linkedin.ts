/**
 * LinkedIn OAuth + publish routes.
 *
 * Mount strategy:
 *  - `publicLinkedinRouter` (callback only) is mounted BEFORE auth so LinkedIn
 *    can redirect the browser back without needing a Clerk session header.
 *    The state parameter is HMAC-signed and carries the userId, so we know
 *    which user the token belongs to without a session.
 *  - `linkedinRouter` (start / status / disconnect / publish) is mounted
 *    AFTER requireAuth + requireAdmin.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  buildAuthorizeUrl,
  deleteConnection,
  exchangeCodeForToken,
  fetchUserInfo,
  getConnection,
  getLinkedinConfig,
  isLinkedinConfigured,
  publishLinkedinPost,
  resolveRedirectUri,
  saveConnection,
  signState,
  verifyState,
} from "../lib/linkedin";
import type { AuthedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

function uid(req: unknown): string {
  return (req as AuthedRequest).userId;
}

// ── PUBLIC (callback) ────────────────────────────────────────────────────

export const publicLinkedinRouter: IRouter = Router();

// Codes courts → messages FR métier (affichés en toast côté UI).
const CALLBACK_FR: Record<string, string> = {
  ok: "ok",
  missing_params: "Paramètres manquants dans la redirection LinkedIn.",
  invalid_state: "Lien de connexion expiré ou déjà utilisé. Relance la connexion.",
  exchange_failed: "Échec de l'échange du jeton avec LinkedIn. Réessaie.",
  user_cancelled: "Connexion annulée côté LinkedIn.",
};

publicLinkedinRouter.get("/auth/linkedin/callback", async (req, res) => {
  const code = typeof req.query["code"] === "string" ? req.query["code"] : null;
  const state = typeof req.query["state"] === "string" ? req.query["state"] : null;
  const errorParam = typeof req.query["error"] === "string" ? req.query["error"] : null;

  const back = (key: string) => {
    const msg = CALLBACK_FR[key] ?? "Erreur LinkedIn inconnue.";
    res.redirect(`/app/account?linkedin=${encodeURIComponent(msg)}`);
  };

  if (errorParam) {
    logger.warn({ errorParam }, "LinkedIn callback returned error");
    return back(errorParam === "user_cancelled_authorize" ? "user_cancelled" : "exchange_failed");
  }
  if (!code || !state) return back("missing_params");

  const verified = verifyState(state);
  if (!verified) return back("invalid_state");

  try {
    // Le redirect_uri envoyé à l'échange DOIT être strictement identique à
    // celui envoyé à l'autorisation. On le recalcule à partir du host actuel.
    const redirectUri = resolveRedirectUri(req);
    const token = await exchangeCodeForToken(code, redirectUri);
    const info = await fetchUserInfo(token.access_token);
    await saveConnection(verified.userId, token, info);
    return back("ok");
  } catch (err) {
    logger.error({ err }, "LinkedIn callback exchange failed");
    return back("exchange_failed");
  }
});

// ── AUTHED ───────────────────────────────────────────────────────────────

const linkedinRouter: IRouter = Router();
export default linkedinRouter;

linkedinRouter.get("/linkedin/status", async (req, res) => {
  if (!isLinkedinConfigured()) {
    res.json({ configured: false, connected: false });
    return;
  }
  const conn = await getConnection(uid(req));
  res.json({
    configured: true,
    connected: !!conn,
    name: conn?.name ?? null,
    email: conn?.email ?? null,
    pictureUrl: conn?.pictureUrl ?? null,
    expiresAt: conn?.expiresAt ?? null,
    expired: !!(conn?.expiresAt && conn.expiresAt.getTime() < Date.now()),
  });
});

linkedinRouter.get("/auth/linkedin/start", async (req, res) => {
  if (!isLinkedinConfigured()) {
    res.status(503).json({ error: "LinkedIn n'est pas configuré côté serveur." });
    return;
  }
  const state = signState(uid(req));
  const redirectUri = resolveRedirectUri(req);
  const url = buildAuthorizeUrl(state, redirectUri);
  // Return URL so the SPA can open it (avoids CORS issues with a server-side 302
  // since fetch() can't follow redirects across origins reliably).
  res.json({ url, redirectUri });
});

linkedinRouter.post("/linkedin/disconnect", async (req, res) => {
  await deleteConnection(uid(req));
  res.json({ ok: true });
});

const publishSchema = z.object({
  text: z.string().min(1).max(3000),
  imageUrl: z.string().url().optional().nullable(),
});

linkedinRouter.post("/linkedin/publish", async (req, res) => {
  const parsed = publishSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
    return;
  }
  const result = await publishLinkedinPost({
    userId: uid(req),
    text: parsed.data.text,
    imageUrl: parsed.data.imageUrl ?? null,
  });
  if (!result.success) {
    res.status(result.notConnected ? 409 : 502).json(result);
    return;
  }
  res.json(result);
});

// Helper export for the SPA: log out of LinkedIn config status (mirrors meta).
linkedinRouter.get("/linkedin/config", (req, res) => {
  const { clientId } = getLinkedinConfig();
  res.json({
    configured: isLinkedinConfigured(),
    clientIdPresent: !!clientId,
    redirectUri: resolveRedirectUri(req),
  });
});
