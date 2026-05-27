/**
 * LinkedIn OAuth + publishing helpers.
 *
 * Scopes used:
 *  - openid, profile, email  → "Sign In with LinkedIn"
 *  - w_member_social         → "Share on LinkedIn" (publish posts as the member)
 *
 * Token storage: per-user row in `linkedin_connections`.
 * State protection: signed HMAC (state = base64url(payload) + "." + hmacSha256(payload, SESSION_SECRET)).
 */
import crypto from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { eq } from "drizzle-orm";
import { db, linkedinConnections } from "@workspace/db";
import { logger } from "./logger";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const UGC_URL = "https://api.linkedin.com/v2/ugcPosts";
const ASSETS_REGISTER_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";
const DEFAULT_SCOPES = "openid profile email w_member_social";

const DEFAULT_REDIRECT_URI = "https://growiqai.replit.app/api/auth/linkedin/callback";

/**
 * Calcule l'URL de callback à envoyer à LinkedIn.
 *
 * LinkedIn exige que `redirect_uri` corresponde EXACTEMENT à l'une des URLs
 * enregistrées dans l'app. Comme l'app peut être servie sur plusieurs domaines
 * (growiqai.replit.app, growiq.tech, etc.), on dérive l'URL du host de la
 * requête actuelle plutôt que de la coder en dur. L'utilisateur doit simplement
 * enregistrer chaque domaine dans LinkedIn Developers.
 *
 * Override possible via LINKEDIN_REDIRECT_URI (force une valeur unique).
 */
export function resolveRedirectUri(req?: { protocol?: string; get?: (h: string) => string | undefined }): string {
  const forced = process.env["LINKEDIN_REDIRECT_URI"];
  if (forced) return forced;
  const host = req?.get?.("host");
  if (host) {
    // Toujours https en prod ; les domaines Replit servent en https derrière le proxy.
    return `https://${host}/api/auth/linkedin/callback`;
  }
  return DEFAULT_REDIRECT_URI;
}

export function getLinkedinConfig() {
  return {
    clientId: process.env["LINKEDIN_CLIENT_ID"],
    clientSecret: process.env["LINKEDIN_CLIENT_SECRET"],
    redirectUri: resolveRedirectUri(),
  };
}

export function isLinkedinConfigured(): boolean {
  const { clientId, clientSecret } = getLinkedinConfig();
  return !!(clientId && clientSecret);
}

// ── Signed state ─────────────────────────────────────────────────────────

function stateSecret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s) throw new Error("SESSION_SECRET is required for LinkedIn OAuth state signing");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signState(userId: string): string {
  const payload = { userId, nonce: crypto.randomBytes(8).toString("hex"), ts: Date.now() };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

// Anti-rejeu: chaque nonce ne peut être consommé qu'une seule fois (in-process).
// Pour un déploiement multi-instances, remplacer par un store partagé.
const usedNonces = new Map<string, number>();
function rememberNonce(nonce: string, ttlMs: number): void {
  const now = Date.now();
  usedNonces.set(nonce, now + ttlMs);
  // Garbage collect à l'occasion.
  if (usedNonces.size > 1000) {
    for (const [k, exp] of usedNonces) if (exp < now) usedNonces.delete(k);
  }
}
function nonceAlreadyUsed(nonce: string): boolean {
  const exp = usedNonces.get(nonce);
  if (!exp) return false;
  if (exp < Date.now()) { usedNonces.delete(nonce); return false; }
  return true;
}

export function verifyState(state: string): { userId: string } | null {
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
    // 10-minute expiry to limit replay.
    const ttl = 10 * 60 * 1000;
    if (Date.now() - json.ts > ttl) return null;
    // One-time use: refuser tout state déjà consommé.
    if (nonceAlreadyUsed(json.nonce)) return null;
    rememberNonce(json.nonce, ttl);
    return { userId: json.userId };
  } catch {
    return null;
  }
}

// ── Authorize URL ────────────────────────────────────────────────────────

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const { clientId } = getLinkedinConfig();
  if (!clientId) throw new Error("LINKEDIN_CLIENT_ID missing");
  const u = new URL(AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", DEFAULT_SCOPES);
  return u.toString();
}

// ── Token exchange ───────────────────────────────────────────────────────

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getLinkedinConfig();
  if (!clientId || !clientSecret) throw new Error("LinkedIn credentials missing");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`LinkedIn token exchange failed (${r.status}): ${txt}`);
  }
  return (await r.json()) as TokenResponse;
}

type UserInfo = {
  sub: string;           // person id (use as "urn:li:person:<sub>")
  name?: string;
  email?: string;
  picture?: string;
};

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const r = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`LinkedIn userinfo failed (${r.status}): ${txt}`);
  }
  return (await r.json()) as UserInfo;
}

// ── Connection storage ───────────────────────────────────────────────────

export async function saveConnection(userId: string, token: TokenResponse, info: UserInfo): Promise<void> {
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 0) * 1000);
  const values = {
    userId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt,
    personUrn: `urn:li:person:${info.sub}`,
    name: info.name ?? null,
    email: info.email ?? null,
    pictureUrl: info.picture ?? null,
    scopes: token.scope ?? DEFAULT_SCOPES,
    updatedAt: new Date(),
  };
  // Upsert atomique sur l'index unique user_id pour éviter une race entre
  // deux callbacks concurrents du même utilisateur.
  await db
    .insert(linkedinConnections)
    .values(values)
    .onConflictDoUpdate({ target: linkedinConnections.userId, set: values });
}

export async function getConnection(userId: string) {
  const [c] = await db
    .select()
    .from(linkedinConnections)
    .where(eq(linkedinConnections.userId, userId))
    .limit(1);
  return c ?? null;
}

export async function deleteConnection(userId: string): Promise<void> {
  await db.delete(linkedinConnections).where(eq(linkedinConnections.userId, userId));
}

// ── Publishing ───────────────────────────────────────────────────────────

export type LinkedinPublishResult =
  | { success: true; postId: string; permalink: string }
  | { success: false; error: string; notConnected?: boolean };

async function registerImageUpload(accessToken: string, ownerUrn: string): Promise<{ uploadUrl: string; assetUrn: string }> {
  const body = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: ownerUrn,
      serviceRelationships: [
        { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
      ],
    },
  };
  const r = await fetch(ASSETS_REGISTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`registerUpload failed (${r.status}): ${txt}`);
  }
  const data = (await r.json()) as {
    value: {
      asset: string;
      uploadMechanism: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl: string };
      };
    };
  };
  return {
    assetUrn: data.value.asset,
    uploadUrl: data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl,
  };
}

// ── SSRF guard ───────────────────────────────────────────────────────────
//
// `imageUrl` arrive du client. On refuse :
//  - tout schéma autre que https
//  - tout host qui résout vers une IP privée / loopback / link-local
//  - tout host non présent dans l'allowlist (object storage GCS public, domaine prod)
//
// L'allowlist couvre les images qu'on génère nous-même via Object Storage.

const IMAGE_HOST_ALLOWLIST: ReadonlyArray<string | RegExp> = [
  /\.googleapis\.com$/i,        // GCS public objects (storage.googleapis.com…)
  /\.googleusercontent\.com$/i, // alternate GCS host
  "growiqai.replit.app",
];

function hostIsAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return IMAGE_HOST_ALLOWLIST.some((p) => (typeof p === "string" ? p === h : p.test(h)));
}

function ipIsPrivate(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true; // link-local (metadata service)
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // ULA
  if (ip.startsWith("fe80:")) return true; // link-local v6
  return false;
}

async function assertSafePublicImageUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new Error("URL d'image invalide"); }
  if (u.protocol !== "https:") throw new Error("Seules les URLs https sont acceptées pour les images");
  if (!hostIsAllowed(u.hostname)) throw new Error(`Host non autorisé pour les images : ${u.hostname}`);
  // Si l'host est une IP littérale, vérifier directement. Sinon, résoudre via DNS.
  if (isIP(u.hostname)) {
    if (ipIsPrivate(u.hostname)) throw new Error("IP privée refusée");
  } else {
    const records = await lookup(u.hostname, { all: true });
    for (const r of records) if (ipIsPrivate(r.address)) throw new Error("DNS résout vers une IP privée");
  }
  return u;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

async function uploadImageBinary(uploadUrl: string, accessToken: string, imageUrl: string): Promise<void> {
  const safeUrl = await assertSafePublicImageUrl(imageUrl);
  const imgRes = await fetch(safeUrl.toString(), { redirect: "manual" });
  if (imgRes.status >= 300 && imgRes.status < 400) {
    throw new Error("Redirections refusées pour les images");
  }
  if (!imgRes.ok) throw new Error(`download image failed (${imgRes.status})`);
  const contentType = imgRes.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error(`Type non-image refusé : ${contentType}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("Image trop grosse (> 10 Mo)");
  const r = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
    body: buf,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`upload image failed (${r.status}): ${txt}`);
  }
}

export async function publishLinkedinPost(opts: {
  userId: string;
  text: string;
  imageUrl?: string | null;
}): Promise<LinkedinPublishResult> {
  const conn = await getConnection(opts.userId);
  if (!conn) return { success: false, error: "LinkedIn non connecté", notConnected: true };
  if (conn.expiresAt && conn.expiresAt.getTime() < Date.now()) {
    return { success: false, error: "Le jeton LinkedIn a expiré, reconnecte-toi." };
  }
  const author = conn.personUrn;
  const accessToken = conn.accessToken;

  try {
    let media: unknown[] = [];
    let shareMediaCategory: "NONE" | "IMAGE" = "NONE";
    if (opts.imageUrl) {
      const { uploadUrl, assetUrn } = await registerImageUpload(accessToken, author);
      await uploadImageBinary(uploadUrl, accessToken, opts.imageUrl);
      shareMediaCategory = "IMAGE";
      media = [
        {
          status: "READY",
          description: { text: "" },
          media: assetUrn,
          title: { text: "" },
        },
      ];
    }

    const body = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: opts.text },
          shareMediaCategory,
          ...(media.length ? { media } : {}),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const r = await fetch(UGC_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      logger.warn({ status: r.status, body: txt }, "LinkedIn publish failed");
      return { success: false, error: `LinkedIn a refusé : ${txt.slice(0, 200)}` };
    }
    const data = (await r.json()) as { id: string };
    const postId = data.id;
    // ugcPost id format: urn:li:share:1234567890 — build a feed permalink.
    const numeric = postId.split(":").pop() ?? "";
    const permalink = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`;
    return { success: true, postId, permalink: numeric ? permalink : "https://www.linkedin.com/feed/" };
  } catch (err) {
    logger.error({ err }, "publishLinkedinPost crashed");
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
