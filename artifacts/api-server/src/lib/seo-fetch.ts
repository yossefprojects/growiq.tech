/**
 * Safe URL fetcher + minimal HTML parser for the SEO audit feature.
 *
 * Safety constraints:
 *   - protocol must be http or https
 *   - hostname must resolve to a public IP (no localhost, no RFC1918, no link-local)
 *   - 10s timeout
 *   - max 2 MB response body
 *   - text/html content-type only
 *
 * Parser: small regex-based extractor — sufficient for title / meta description /
 * h1 / h2 / image alts / approximate word count. We do NOT execute JS; this is
 * intentional (server-side, no headless browser).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:0:a.b.c.d)
  const mapped = /^::ffff:(?:0:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(lower);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  // Also handle hex-form IPv4-mapped: ::ffff:7f00:0001
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(lower);
  if (hexMapped) {
    const high = parseInt(hexMapped[1]!, 16);
    const low = parseInt(hexMapped[2]!, 16);
    const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    return isPrivateIPv4(ipv4);
  }
  return false;
}

async function validateUrlIsPublic(url: URL): Promise<{ ok: true } | { ok: false; error: string }> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Seuls les liens http(s) sont autorisés" };
  }
  try {
    const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
    const ipLiteral = isIP(host);
    const addrs = ipLiteral ? [{ address: host, family: ipLiteral }] : await lookup(host, { all: true });
    for (const a of addrs) {
      const bad = a.family === 6 ? isPrivateIPv6(a.address) : isPrivateIPv4(a.address);
      if (bad) return { ok: false, error: "Cette adresse n'est pas accessible publiquement" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Impossible de résoudre ce nom de domaine" };
  }
}

export type FetchedPage = {
  finalUrl: string;
  html: string;
  bytes: number;
};

const MAX_REDIRECTS = 5;

export async function safeFetchHtml(rawUrl: string): Promise<
  { ok: true; page: FetchedPage } | { ok: false; error: string }
> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { ok: false, error: "URL invalide" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response | null = null;
    // Manual redirect handling: revalidate IP/protocol at each hop to prevent SSRF
    // via a public domain redirecting to a private IP / metadata service.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const check = await validateUrlIsPublic(current);
      if (!check.ok) return check;
      res = await fetch(current.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "GrowIQ-SEO-Audit/1.0 (+https://growiq.app)",
          Accept: "text/html",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, error: "Redirection invalide" };
        try {
          current = new URL(loc, current);
        } catch {
          return { ok: false, error: "URL de redirection invalide" };
        }
        continue;
      }
      break;
    }
    if (!res) return { ok: false, error: "Réponse vide" };
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: "Trop de redirections" };
    }
    if (!res.ok) {
      return { ok: false, error: `Le site a répondu HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html")) {
      return { ok: false, error: "Cette URL ne renvoie pas une page HTML" };
    }

    // Read body with size cap
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: "Réponse vide" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          return { ok: false, error: "Page trop volumineuse (>2 Mo)" };
        }
        chunks.push(value);
      }
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const html = buf.toString("utf8");
    return { ok: true, page: { finalUrl: current.toString(), html, bytes: total } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted")) return { ok: false, error: "Délai dépassé (10 s)" };
    return { ok: false, error: "Échec de la récupération de la page" };
  } finally {
    clearTimeout(timeout);
  }
}

export type ParsedHtml = {
  title: string | null;
  metaDescription: string | null;
  language: string | null;
  h1: string[];
  h2: string[];
  imagesTotal: number;
  imagesMissingAlt: number;
  wordCount: number;
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function matchAllTagContent(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const content = m[1];
    if (content) {
      const txt = stripTags(content);
      if (txt) out.push(txt);
    }
  }
  return out;
}

export function parseHtml(html: string): ParsedHtml {
  // Strip script/style for word counting and avoid noise
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  const titleM = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleM?.[1] ? stripTags(titleM[1]).slice(0, 500) : null;

  const descM = /<meta[^>]+name=["']description["'][^>]*>/i.exec(html);
  let metaDescription: string | null = null;
  if (descM) {
    const contentM = /content=["']([^"']*)["']/i.exec(descM[0]);
    if (contentM?.[1]) metaDescription = contentM[1].slice(0, 500);
  }

  const langM = /<html[^>]*\blang=["']([^"']+)["']/i.exec(html);
  const language = langM?.[1] ?? null;

  const h1 = matchAllTagContent(html, "h1").map((s) => s.slice(0, 200)).slice(0, 5);
  const h2 = matchAllTagContent(html, "h2").map((s) => s.slice(0, 200)).slice(0, 10);

  // Images
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesTotal = imgs.length;
  let imagesMissingAlt = 0;
  for (const img of imgs) {
    const altM = /\balt=["']([^"']*)["']/i.exec(img);
    if (!altM || !altM[1] || altM[1].trim() === "") imagesMissingAlt++;
  }

  const text = stripTags(cleaned);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return { title, metaDescription, language, h1, h2, imagesTotal, imagesMissingAlt, wordCount };
}
