import { logger } from "./logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export type MetaPublishResult =
  | { success: true; postId: string; permalink?: string }
  | { success: false; error: string; configMissing?: boolean };

function getConfig(): { token?: string; fbPageId?: string; igUserId?: string } {
  return {
    token: process.env["META_ACCESS_TOKEN"],
    fbPageId: process.env["META_FB_PAGE_ID"],
    igUserId: process.env["META_IG_USER_ID"],
  };
}

export function isMetaConfigured(platform: "facebook" | "instagram"): boolean {
  const { token, fbPageId, igUserId } = getConfig();
  if (!token) return false;
  return platform === "facebook" ? !!fbPageId : !!igUserId;
}

async function graphFetch(
  path: string,
  method: "GET" | "POST",
  token: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const url = `${GRAPH_BASE}${path}`;
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const init: RequestInit = { method, headers };
    if (body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data["error"] as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      return { ok: false, error: err };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Publish a text-only post to a Facebook Page.
 * Requires META_ACCESS_TOKEN (Page token with `pages_manage_posts`) and META_FB_PAGE_ID.
 */
export async function publishFacebookText(message: string): Promise<MetaPublishResult> {
  const { token, fbPageId } = getConfig();
  if (!token || !fbPageId) {
    return { success: false, error: "META_ACCESS_TOKEN ou META_FB_PAGE_ID manquant", configMissing: true };
  }
  const result = await graphFetch(`/${fbPageId}/feed`, "POST", token, {
    message,
  });
  if (!result.ok) {
    logger.warn({ err: result.error }, "Facebook publish failed");
    return { success: false, error: result.error };
  }
  const postId = String(result.data["id"] ?? "");
  return { success: true, postId, permalink: `https://www.facebook.com/${postId}` };
}

/**
 * Publish a photo to a Facebook Page from a public image URL with a caption.
 */
export async function publishFacebookImage(imageUrl: string, caption: string): Promise<MetaPublishResult> {
  const { token, fbPageId } = getConfig();
  if (!token || !fbPageId) {
    return { success: false, error: "META_ACCESS_TOKEN ou META_FB_PAGE_ID manquant", configMissing: true };
  }
  const result = await graphFetch(`/${fbPageId}/photos`, "POST", token, {
    url: imageUrl,
    caption,
    published: true,
  });
  if (!result.ok) {
    logger.warn({ err: result.error }, "Facebook image publish failed");
    return { success: false, error: result.error };
  }
  const postId = String(result.data["post_id"] ?? result.data["id"] ?? "");
  return { success: true, postId, permalink: postId ? `https://www.facebook.com/${postId}` : undefined };
}

/**
 * Publish an image post to Instagram (Business/Creator account linked to a FB Page).
 * Two-step flow per Meta docs: create container, then publish container.
 * imageUrl MUST be a publicly accessible HTTPS URL — Instagram does not accept binary uploads.
 */
export async function publishInstagramImage(
  imageUrl: string,
  caption: string,
): Promise<MetaPublishResult> {
  const { token, igUserId } = getConfig();
  if (!token || !igUserId) {
    return { success: false, error: "META_ACCESS_TOKEN ou META_IG_USER_ID manquant", configMissing: true };
  }
  if (!/^https:\/\//i.test(imageUrl)) {
    return { success: false, error: "L'URL de l'image doit être HTTPS et publiquement accessible" };
  }

  // Step 1: create media container
  const container = await graphFetch(`/${igUserId}/media`, "POST", token, {
    image_url: imageUrl,
    caption,
  });
  if (!container.ok) {
    logger.warn({ err: container.error }, "Instagram container creation failed");
    return { success: false, error: container.error };
  }
  const creationId = String(container.data["id"] ?? "");
  if (!creationId) return { success: false, error: "Container Instagram sans id" };

  // Step 2: publish container
  const publish = await graphFetch(`/${igUserId}/media_publish`, "POST", token, {
    creation_id: creationId,
  });
  if (!publish.ok) {
    logger.warn({ err: publish.error }, "Instagram publish failed");
    return { success: false, error: publish.error };
  }
  const postId = String(publish.data["id"] ?? "");

  // Step 3 (optional): fetch permalink
  let permalink: string | undefined;
  if (postId) {
    const meta = await graphFetch(`/${postId}?fields=permalink`, "GET", token);
    if (meta.ok && typeof meta.data["permalink"] === "string") {
      permalink = meta.data["permalink"];
    }
  }
  return { success: true, postId, permalink };
}

/**
 * Convenience dispatcher used by the scheduler worker.
 */
export async function publishToMeta(opts: {
  platform: "facebook" | "instagram";
  message: string;
  imageUrl?: string;
}): Promise<MetaPublishResult> {
  const { platform, message, imageUrl } = opts;
  if (platform === "instagram") {
    if (!imageUrl) {
      return { success: false, error: "Instagram exige une image (imageUrl requis)" };
    }
    return publishInstagramImage(imageUrl, message);
  }
  if (imageUrl) return publishFacebookImage(imageUrl, message);
  return publishFacebookText(message);
}
