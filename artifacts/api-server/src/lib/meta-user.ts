/**
 * Publication FB / IG en utilisant les credentials per-user stockés dans
 * `user_integrations` (platform="meta").
 *
 * Reste compatible avec le helper admin `publishToMeta` (lib/meta.ts) pour les
 * flows admin only (ads management qui utilise le compte business GrowIQ).
 *
 * Le résultat est une discriminated union qui inclut `notConnected` pour
 * permettre à l'UI de proposer "Connecte d'abord ton compte" plutôt qu'un
 * message d'erreur générique.
 */
import { getUserIntegration, markIntegrationStatus } from "./user-integrations";
import { assertSafePublicImageUrl } from "./image-url-safety";
import { logger } from "./logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export type MetaUserPublishResult =
  | { success: true; postId: string; permalink?: string }
  | {
      success: false;
      error: string;
      notConnected?: boolean;
      tokenExpired?: boolean;
      missingInstagram?: boolean;
    };

type MetaCredentials = {
  fbPageId: string;
  fbPageToken: string;
  igUserId?: string;
};

/**
 * Extrait les credentials nécessaires pour publier depuis l'intégration Meta
 * de l'utilisateur. Retourne null si non connecté ou expiré.
 */
export async function getMetaCredentialsForUser(
  userId: string,
  platform: "facebook" | "instagram",
): Promise<{ creds: MetaCredentials } | { error: MetaUserPublishResult }> {
  const conn = await getUserIntegration(userId, "meta");
  if (!conn) {
    return {
      error: {
        success: false,
        error: "Connecte d'abord ton compte Facebook depuis 'Mes outils'.",
        notConnected: true,
      },
    };
  }
  if (conn.status !== "active") {
    return {
      error: {
        success: false,
        error: "Ton accès Meta n'est plus actif. Reconnecte-toi.",
        tokenExpired: true,
      },
    };
  }
  if (conn.expiresAt && conn.expiresAt.getTime() < Date.now()) {
    await markIntegrationStatus(userId, "meta", "expired", "Token expiré");
    return {
      success: false as never,
      error: {
        success: false,
        error: "Ton jeton Facebook a expiré. Reconnecte-toi (1 min).",
        tokenExpired: true,
      },
    } as unknown as { error: MetaUserPublishResult };
  }

  const meta = conn.metadata;
  const pages = meta.facebookPages ?? [];
  const selectedPageId = meta.selectedFacebookPageId ?? pages[0]?.id ?? conn.accountId;
  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? pages[0];

  if (!selectedPage) {
    return {
      error: {
        success: false,
        error: "Aucune page Facebook trouvée sur ton compte. Crée-en une depuis Facebook puis reconnecte-toi.",
        notConnected: true,
      },
    };
  }

  if (platform === "instagram") {
    const igId = meta.instagramAccount?.id;
    if (!igId) {
      return {
        error: {
          success: false,
          error: "Aucun compte Instagram Business lié à ta page Facebook. Lie-le depuis l'app Instagram puis reconnecte-toi.",
          missingInstagram: true,
        },
      };
    }
    return { creds: { fbPageId: selectedPage.id, fbPageToken: selectedPage.accessToken, igUserId: igId } };
  }

  return { creds: { fbPageId: selectedPage.id, fbPageToken: selectedPage.accessToken } };
}

async function graphFetch(
  path: string,
  method: "GET" | "POST",
  token: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; code?: number }> {
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
      const err = (data["error"] as { message?: string; code?: number } | undefined);
      return { ok: false, error: err?.message ?? `HTTP ${res.status}`, code: err?.code };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Codes Meta qui signifient "token mort" → on marque l'integration comme expirée.
// 190 = invalid token, 102 = session expired, 463 = expired access.
function isTokenError(code?: number): boolean {
  return code === 190 || code === 102 || code === 463;
}

export async function publishToMetaForUser(opts: {
  userId: string;
  platform: "facebook" | "instagram";
  message: string;
  imageUrl?: string;
}): Promise<MetaUserPublishResult> {
  const { userId, platform, message, imageUrl } = opts;
  const got = await getMetaCredentialsForUser(userId, platform);
  if ("error" in got) return got.error;
  const { creds } = got;

  // FB text only
  if (platform === "facebook" && !imageUrl) {
    const r = await graphFetch(`/${creds.fbPageId}/feed`, "POST", creds.fbPageToken, { message });
    if (!r.ok) {
      if (isTokenError(r.code)) {
        await markIntegrationStatus(userId, "meta", "expired", r.error);
      }
      logger.warn({ err: r.error }, "publishToMetaForUser facebook text failed");
      return { success: false, error: r.error };
    }
    const postId = String(r.data["id"] ?? "");
    return { success: true, postId, permalink: `https://www.facebook.com/${postId}` };
  }

  // FB image
  if (platform === "facebook" && imageUrl) {
    // SSRF guard : Meta télécharge cette URL côté serveur — on refuse les
    // hosts hors allowlist (Object Storage GCS) et les DNS qui résolvent vers
    // des IPs privées (sinon l'attaquant peut scanner notre réseau interne).
    let safeUrl: URL;
    try {
      safeUrl = await assertSafePublicImageUrl(imageUrl);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "URL image refusée" };
    }
    const r = await graphFetch(`/${creds.fbPageId}/photos`, "POST", creds.fbPageToken, {
      url: safeUrl.toString(),
      caption: message,
      published: true,
    });
    if (!r.ok) {
      if (isTokenError(r.code)) {
        await markIntegrationStatus(userId, "meta", "expired", r.error);
      }
      logger.warn({ err: r.error }, "publishToMetaForUser facebook image failed");
      return { success: false, error: r.error };
    }
    const postId = String(r.data["post_id"] ?? r.data["id"] ?? "");
    return { success: true, postId, permalink: postId ? `https://www.facebook.com/${postId}` : undefined };
  }

  // IG image (obligatoire)
  if (!imageUrl) {
    return { success: false, error: "Instagram exige une image." };
  }
  if (!/^https:\/\//i.test(imageUrl)) {
    return { success: false, error: "L'URL de l'image doit être HTTPS et publique." };
  }
  if (!creds.igUserId) {
    return { success: false, error: "Compte Instagram manquant.", missingInstagram: true };
  }
  // SSRF guard sur l'URL transmise au Graph API (cf. commentaire FB image).
  let safeIgUrl: URL;
  try {
    safeIgUrl = await assertSafePublicImageUrl(imageUrl);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "URL image refusée" };
  }
  const container = await graphFetch(`/${creds.igUserId}/media`, "POST", creds.fbPageToken, {
    image_url: safeIgUrl.toString(),
    caption: message,
  });
  if (!container.ok) {
    if (isTokenError(container.code)) {
      await markIntegrationStatus(userId, "meta", "expired", container.error);
    }
    return { success: false, error: container.error };
  }
  const creationId = String(container.data["id"] ?? "");
  if (!creationId) return { success: false, error: "Container Instagram sans id" };

  const pub = await graphFetch(`/${creds.igUserId}/media_publish`, "POST", creds.fbPageToken, {
    creation_id: creationId,
  });
  if (!pub.ok) {
    if (isTokenError(pub.code)) {
      await markIntegrationStatus(userId, "meta", "expired", pub.error);
    }
    return { success: false, error: pub.error };
  }
  const postId = String(pub.data["id"] ?? "");
  let permalink: string | undefined;
  if (postId) {
    const meta = await graphFetch(`/${postId}?fields=permalink`, "GET", creds.fbPageToken);
    if (meta.ok && typeof meta.data["permalink"] === "string") {
      permalink = meta.data["permalink"];
    }
  }
  return { success: true, postId, permalink };
}

/**
 * Récupère le profile (nom + avatar) de la page FB ou compte IG connecté de
 * l'user, pour affichage UI (page Connecter mes outils, preview agency).
 */
export async function getMetaProfileForUser(
  userId: string,
  platform: "facebook" | "instagram",
): Promise<{ name: string; pictureUrl: string } | null> {
  const got = await getMetaCredentialsForUser(userId, platform);
  if ("error" in got) return null;
  const { creds } = got;
  if (platform === "facebook") {
    const r = await graphFetch(`/${creds.fbPageId}?fields=name,picture.type(large)`, "GET", creds.fbPageToken);
    if (!r.ok) return null;
    const name = typeof r.data["name"] === "string" ? r.data["name"] : "Ma Page";
    const pic = r.data["picture"] as { data?: { url?: string } } | undefined;
    return { name, pictureUrl: pic?.data?.url ?? "" };
  }
  if (!creds.igUserId) return null;
  const r = await graphFetch(
    `/${creds.igUserId}?fields=username,profile_picture_url`,
    "GET",
    creds.fbPageToken,
  );
  if (!r.ok) return null;
  const name = typeof r.data["username"] === "string" ? `@${r.data["username"]}` : "Mon compte";
  const pic = typeof r.data["profile_picture_url"] === "string" ? r.data["profile_picture_url"] : "";
  return { name, pictureUrl: pic };
}
