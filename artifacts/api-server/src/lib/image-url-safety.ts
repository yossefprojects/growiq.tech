/**
 * SSRF guard partagé pour les URLs d'image envoyées à des APIs tierces
 * (LinkedIn, Meta Graph API). On refuse :
 *  - tout schéma autre que https
 *  - tout host qui résout vers une IP privée / loopback / link-local
 *  - tout host non présent dans l'allowlist (Object Storage GCS, domaine prod)
 *
 * L'allowlist couvre les images qu'on génère nous-même via Object Storage.
 * Si demain on accepte des URLs d'image fournies par l'user (uploads externes),
 * il faudra revoir cette liste.
 */
import { isIP } from "node:net";
import { promises as dns } from "node:dns";

const IMAGE_HOST_ALLOWLIST: ReadonlyArray<string | RegExp> = [
  /\.googleapis\.com$/i, // GCS public objects (storage.googleapis.com…)
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

/**
 * Lève si l'URL ne passe pas le guard SSRF. Retourne l'URL validée sinon.
 * À appeler avant de transmettre une URL d'image à une API tierce qui va
 * la télécharger côté serveur (sinon l'attaquant pourrait scanner notre réseau
 * interne via l'API tierce).
 */
export async function assertSafePublicImageUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("URL d'image invalide");
  }
  if (u.protocol !== "https:") {
    throw new Error("Seules les URLs https sont acceptées pour les images");
  }
  if (!hostIsAllowed(u.hostname)) {
    throw new Error(`Host non autorisé pour les images : ${u.hostname}`);
  }
  if (isIP(u.hostname)) {
    if (ipIsPrivate(u.hostname)) throw new Error("IP privée refusée");
  } else {
    const records = await dns.lookup(u.hostname, { all: true });
    for (const r of records) {
      if (ipIsPrivate(r.address)) throw new Error("DNS résout vers une IP privée");
    }
  }
  return u;
}
