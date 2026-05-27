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
import { eq } from "drizzle-orm";
import { db, linkedinConnections } from "@workspace/db";
import { logger } from "./logger";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const UGC_URL = "https://api.linkedin.com/v2/ugcPosts";
const ASSETS_REGISTER_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";
const DEFAULT_SCOPES = "openid profile email w_member_social";

export function getLinkedinConfig() {
  return {
    clientId: process.env["LINKEDIN_CLIENT_ID"],
    clientSecret: process.env["LINKEDIN_CLIENT_SECRET"],
    redirectUri:
      process.env["LINKEDIN_REDIRECT_URI"] ??
      "https://growiqai.replit.app/api/auth/linkedin/callback",
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
      ts: number;
    };
    // 10-minute expiry to limit replay.
    if (Date.now() - json.ts > 10 * 60 * 1000) return null;
    return { userId: json.userId };
  } catch {
    return null;
  }
}

// ── Authorize URL ────────────────────────────────────────────────────────

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getLinkedinConfig();
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

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getLinkedinConfig();
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
  const [existing] = await db
    .select({ id: linkedinConnections.id })
    .from(linkedinConnections)
    .where(eq(linkedinConnections.userId, userId))
    .limit(1);
  if (existing) {
    await db.update(linkedinConnections).set(values).where(eq(linkedinConnections.id, existing.id));
  } else {
    await db.insert(linkedinConnections).values(values);
  }
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

async function uploadImageBinary(uploadUrl: string, accessToken: string, imageUrl: string): Promise<void> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`download image failed (${imgRes.status})`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const r = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
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
