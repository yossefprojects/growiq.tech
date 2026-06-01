/**
 * Facebook / Instagram OAuth helpers (per-user).
 *
 * Flow :
 *  1. /api/auth/facebook/start   → renvoie l'URL d'autorisation Meta
 *  2. (user → Facebook → callback)
 *  3. /api/auth/facebook/callback → exchange code, long-lived exchange,
 *     fetch pages + IG account, save en `user_integrations` (platform=meta).
 *
 * Scopes demandés :
 *   - public_profile, email           → identité de base
 *   - pages_show_list                 → lister les pages dont l'user est admin
 *   - pages_manage_posts              → publier sur les pages
 *   - pages_read_engagement           → lire les stats des pages
 *   - instagram_basic                 → infos compte IG lié
 *   - instagram_content_publish       → publier sur IG
 *   - business_management             → certaines pages dans BM
 *
 * Important : ces scopes nécessitent App Review Meta avant d'être utilisables
 * par des comptes hors testeurs. Tant que la review n'est pas validée, le
 * callback marchera uniquement pour les comptes ajoutés comme "Testers" dans
 * developers.facebook.com.
 */
import crypto from "node:crypto";
import { logger } from "./logger";

const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const GRAPH_BASE = "https://graph.facebook.com/v21.0";

const DEFAULT_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
  // NOTE : les scopes Meta Ads (ads_management, ads_read) sont volontairement
  // retirés du login par défaut. Tant que Meta n'a pas approuvé l'App Review,
  // demander ces scopes avancés fait échouer TOUT le dialogue d'autorisation
  // ("Invalid Scopes" / "Ce contenu n'est pas disponible"), même pour publier.
  // À réintégrer dans un flow Meta Ads opt-in une fois l'approbation obtenue.
].join(",");

export type FacebookConfig = {
  appId?: string;
  appSecret?: string;
};

export function getFacebookConfig(): FacebookConfig {
  return {
    appId: process.env["META_APP_ID"],
    appSecret: process.env["META_APP_SECRET"],
  };
}

export function isFacebookOAuthConfigured(): boolean {
  const { appId, appSecret } = getFacebookConfig();
  return !!(appId && appSecret);
}

export function resolveFacebookRedirectUri(req?: {
  get?: (h: string) => string | undefined;
}): string {
  const forced = process.env["FACEBOOK_REDIRECT_URI"];
  if (forced) return forced;
  const host = req?.get?.("host");
  if (host) return `https://${host}/api/auth/facebook/callback`;
  return "https://growiqai.replit.app/api/auth/facebook/callback";
}

// ── Signed state (anti-CSRF + anti-rejeu) ────────────────────────────────
//
// Même pattern que LinkedIn : HMAC SHA-256 sur payload base64url qui contient
// {userId, nonce, ts}. Nonce single-use in-memory (TTL 10 min). Pour du
// multi-instances, remplacer par un store partagé (Redis).

function stateSecret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s) throw new Error("SESSION_SECRET required for Facebook OAuth state signing");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signFacebookState(userId: string): string {
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
  if (e < Date.now()) { usedNonces.delete(n); return false; }
  return true;
}

export function verifyFacebookState(state: string): { userId: string } | null {
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
      userId: string; nonce: string; ts: number;
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

export function buildFacebookAuthorizeUrl(state: string, redirectUri: string): string {
  const { appId } = getFacebookConfig();
  if (!appId) throw new Error("META_APP_ID missing");
  const u = new URL(FB_AUTH_URL);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", DEFAULT_SCOPES);
  u.searchParams.set("response_type", "code");
  // Force re-prompt si l'user avait refusé un scope (sinon FB skip silencieusement)
  u.searchParams.set("auth_type", "rerequest");
  return u.toString();
}

// ── Token exchange ───────────────────────────────────────────────────────

type ShortLivedTokenResponse = { access_token: string; token_type?: string; expires_in?: number };

export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
): Promise<ShortLivedTokenResponse> {
  const { appId, appSecret } = getFacebookConfig();
  if (!appId || !appSecret) throw new Error("Facebook credentials missing");
  const u = new URL(`${GRAPH_BASE}/oauth/access_token`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("code", code);
  const r = await fetch(u.toString());
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Facebook code exchange failed (${r.status}): ${txt}`);
  }
  return (await r.json()) as ShortLivedTokenResponse;
}

// Convertit le short-lived (1h) en long-lived (~60 jours).
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<ShortLivedTokenResponse> {
  const { appId, appSecret } = getFacebookConfig();
  if (!appId || !appSecret) throw new Error("Facebook credentials missing");
  const u = new URL(`${GRAPH_BASE}/oauth/access_token`);
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("fb_exchange_token", shortLivedToken);
  const r = await fetch(u.toString());
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Facebook long-lived exchange failed (${r.status}): ${txt}`);
  }
  return (await r.json()) as ShortLivedTokenResponse;
}

// ── User info + pages ────────────────────────────────────────────────────

export type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  instagram_business_account?: { id: string; username?: string };
};

export async function fetchFacebookMe(
  userToken: string,
): Promise<{ id: string; name: string; email?: string }> {
  const u = new URL(`${GRAPH_BASE}/me`);
  u.searchParams.set("fields", "id,name,email");
  u.searchParams.set("access_token", userToken);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Facebook /me failed (${r.status}): ${await r.text()}`);
  return (await r.json()) as { id: string; name: string; email?: string };
}

export type FacebookAdAccount = {
  id: string; // ex "act_1234567890"
  name: string;
  account_status?: number; // 1 = ACTIVE, 2 = DISABLED, etc.
  currency?: string;
};

export async function fetchFacebookAdAccounts(userToken: string): Promise<FacebookAdAccount[]> {
  const u = new URL(`${GRAPH_BASE}/me/adaccounts`);
  u.searchParams.set("fields", "id,name,account_status,currency");
  u.searchParams.set("access_token", userToken);
  const r = await fetch(u.toString());
  if (!r.ok) {
    const txt = await r.text();
    logger.warn({ status: r.status, body: txt }, "fetchFacebookAdAccounts failed");
    // Non-fatal : l'user peut avoir refusé ads_management ou ne pas avoir de compte pub
    return [];
  }
  const data = (await r.json()) as { data?: FacebookAdAccount[] };
  return data.data ?? [];
}

export async function fetchFacebookPages(userToken: string): Promise<FacebookPage[]> {
  const u = new URL(`${GRAPH_BASE}/me/accounts`);
  u.searchParams.set(
    "fields",
    "id,name,access_token,category,instagram_business_account{id,username}",
  );
  u.searchParams.set("access_token", userToken);
  const r = await fetch(u.toString());
  if (!r.ok) {
    const txt = await r.text();
    logger.warn({ status: r.status, body: txt }, "fetchFacebookPages failed");
    throw new Error(`Facebook /me/accounts failed (${r.status}): ${txt}`);
  }
  const data = (await r.json()) as { data?: FacebookPage[] };
  return data.data ?? [];
}
