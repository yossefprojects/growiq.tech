import { Storage, type File } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { logger } from "./logger";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function getPublicBasePath(): { bucketName: string; prefix: string } {
  const pathsStr = process.env["PUBLIC_OBJECT_SEARCH_PATHS"] ?? "";
  const first = pathsStr.split(",").map((p) => p.trim()).filter(Boolean)[0];
  if (!first) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  }
  const normalized = first.startsWith("/") ? first.slice(1) : first;
  const parts = normalized.split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  return { bucketName, prefix };
}

/**
 * Upload a buffer to the public area of the bucket and return:
 *  - relativePath: where it lives inside PUBLIC_OBJECT_SEARCH_PATHS (use to serve)
 *  - publicUrl: a fully qualified HTTPS URL on the app's own domain (suitable for Meta)
 */
export async function uploadPublicBuffer(
  buffer: Buffer,
  opts: { ext: string; contentType: string },
): Promise<{ relativePath: string; publicUrl: string }> {
  const { bucketName, prefix } = getPublicBasePath();
  const filename = `${randomUUID()}.${opts.ext}`;
  const objectName = prefix ? `${prefix}/generated/${filename}` : `generated/${filename}`;
  const file = gcs.bucket(bucketName).file(objectName);
  await file.save(buffer, {
    contentType: opts.contentType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  const relativePath = `generated/${filename}`;
  const publicUrl = buildPublicUrl(relativePath);
  logger.info({ objectName, publicUrl }, "Uploaded public buffer");
  return { relativePath, publicUrl };
}

function buildPublicUrl(relativePath: string): string {
  const domains = (process.env["REPLIT_DOMAINS"] ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const host = domains[0] ?? process.env["REPLIT_DEV_DOMAIN"] ?? "";
  if (!host) {
    throw new Error("REPLIT_DOMAINS / REPLIT_DEV_DOMAIN not available — cannot build public URL");
  }
  return `https://${host}/api/storage/public-objects/${relativePath}`;
}

/**
 * Search the configured PUBLIC_OBJECT_SEARCH_PATHS for a file matching the relative path.
 * Returns the GCS File handle or null. Used by the serving route.
 */
export async function findPublicObject(relativePath: string): Promise<File | null> {
  const pathsStr = process.env["PUBLIC_OBJECT_SEARCH_PATHS"] ?? "";
  const searchPaths = pathsStr.split(",").map((p) => p.trim()).filter(Boolean);
  for (const sp of searchPaths) {
    const normalized = sp.startsWith("/") ? sp.slice(1) : sp;
    const [bucketName, ...prefixParts] = normalized.split("/");
    const prefix = prefixParts.join("/");
    const objectName = prefix ? `${prefix}/${relativePath}` : relativePath;
    const file = gcs.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (exists) return file;
  }
  return null;
}

/**
 * Télécharge les octets d'un fichier du bucket public à partir de son path relatif.
 * Utilisé pour ré-encoder une pièce jointe en base64 au moment de l'envoi email.
 */
export async function downloadPublicObject(relativePath: string): Promise<Buffer> {
  const file = await findPublicObject(relativePath);
  if (!file) {
    throw new Error(`Fichier introuvable dans le bucket public : ${relativePath}`);
  }
  const [buffer] = await file.download();
  return buffer;
}

export async function streamPublicObject(file: File): Promise<{
  body: ReadableStream;
  contentType: string;
  size?: string;
}> {
  const [metadata] = await file.getMetadata();
  const nodeStream = file.createReadStream();
  const body = Readable.toWeb(nodeStream) as ReadableStream;
  return {
    body,
    contentType: (metadata.contentType as string) ?? "application/octet-stream",
    size: metadata.size ? String(metadata.size) : undefined,
  };
}
