/**
 * Google OAuth helpers (per-user) — pour Google Ads.
 *
 * Flow :
 *  1. /api/auth/google/start    → URL d'autorisation Google
 *  2. (user → Google → callback)
 *  3. /api/auth/google/callback → exchange code, save refresh_token en
 *     `user_integrations` (platform=google_ads).
 *
 * Scope demandé :
 *   - https://www.googleapis.com/auth/adwords  → API Google Ads
 *   - openid + email                            → identifier le compte connecté
 *
 * Important : la connexion OAuth elle-même fonctionne sans Developer Token.
 * Mais pour créer/lire des campagnes via l'API Google Ads, il faut en plus
 * `GOOGLE_ADS_DEVELOPER_TOKEN` (Basic Access validé par Google, 2-6 semaines).
 * Tant que le token n'est pas là, l'OAuth réussit mais les opérations Ads
 * échoueront — d'où le champ `apiReady` dans /api/integrations.
 */
import crypto from "node:crypto";
import { logger } from "./logger";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "openid",
  "email",
].join(" ");

export type GoogleOAuthConfig = {
  clientId?: string;
  clientSecret?: string;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: process.env["GOOGLE_OAUTH_CLIENT_ID"],
    clientSecret: process.env["GOOGLE_OAUTH_CLIENT_SECRET"],
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  return !!(clientId && clientSecret);
}

export function resolveGoogleRedirectUri(req?: {
  get?: (h: string) => string | undefined;
}): string {
  const forced = process.env["GOOGLE_REDIRECT_URI"];
  if (forced) return forced;
  const host = req?.get?.("host");
  if (host) return `https://${host}/api/auth/google/callback`;
  return "https://growiqai.replit.app/api/auth/google/callback";
}

// ── Signed state (anti-CSRF + anti-rejeu) ────────────────────────────────
// Même pattern qu'OAuth Facebook : HMAC SHA-256 sur payload base64url.

function stateSecret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s) throw new Error("SESSION_SECRET required for Google OAuth state signing");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signGoogleState(userId: string): string {
  const payload = { userId, nonce: crypto.randomBytes(8).toString("hex"), ts: Date.now() };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

const usedNonces = new Map<string, number>();
function rememberNonce(n: string, ttl: number): void {
  const now = Date.now();
  usedNonces.set(n, now + ttl);
  if (usedNonces.size > 1000) {
    for (const [k, exp] of usedNonces) if (exp < now) usedNonces.delete(k);
  }
}
function nonceUsed(n: string): boolean {
  const e = usedNonces.get(n);
  if (!e) return false;
  if (e < Date.now()) {
    usedNonces.delete(n);
    return false;
  }
  return true;
}

export function verifyGoogleState(state: string): { userId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", stateSecret()).update(body).digest());
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const json = JSON.parse(b64urlDecode(body).toString("utf8")) as {
      userId: string;
      nonce: string;
      ts: number;
    };
    const ttl = 10 * 60 * 1000;
    if (Date.now() - json.ts > ttl) return null;
    if (nonceUsed(json.nonce)) return null;
    rememberNonce(json.nonce, ttl);
    return { userId: json.userId };
  } catch {
    return null;
  }
}

// ── Authorize URL ────────────────────────────────────────────────────────

export function buildGoogleAuthorizeUrl(state: string, redirectUri: string): string {
  const { clientId } = getGoogleOAuthConfig();
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID missing");
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("state", state);
  // `offline` + `consent` = nécessaire pour obtenir un refresh_token réutilisable.
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  return u.toString();
}

// ── Token exchange ───────────────────────────────────────────────────────

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
};

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials missing");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Google token exchange failed (${r.status}): ${txt}`);
  }
  return (await r.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<{ sub: string; email?: string; name?: string; picture?: string }> {
  const r = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    const txt = await r.text();
    logger.warn({ status: r.status, body: txt }, "Google userinfo failed");
    throw new Error(`Google userinfo failed (${r.status})`);
  }
  return (await r.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}
