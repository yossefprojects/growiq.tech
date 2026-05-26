/**
 * Translate raw provider error messages (Meta Graph API, email providers, OpenAI,
 * network, DB, etc.) into short, friendly French messages with a hint on what to
 * do next.
 *
 * Used at display time so it also cleans up errors already persisted in the DB.
 */

export type Humanized = { message: string; hint?: string };

export function humanizeError(raw: unknown): Humanized | null {
  const s = extractMessage(raw);
  if (!s) return null;
  const lower = s.toLowerCase();

  // ── Meta Graph API ────────────────────────────────────────────────────────
  if (lower.includes("does not exist") && lower.includes("missing permissions")) {
    return {
      message: "Compte Facebook/Instagram introuvable ou permissions manquantes.",
      hint: "Vérifie que ton compte Instagram est bien un compte Pro lié à ta Page Facebook, et que le token Meta est à jour.",
    };
  }
  if (lower.includes("invalid oauth access token") || lower.includes("session has expired")) {
    return {
      message: "Ton accès Facebook/Instagram a expiré.",
      hint: "Régénère le token Meta dans les secrets du projet.",
    };
  }
  if (lower.includes("(#10)") || lower.includes("permission")) {
    if (lower.includes("ads_management") || lower.includes("ads_read")) {
      return {
        message: "Permission publicité Facebook pas encore accordée.",
        hint: "L'App Review Meta pour ads_management est en attente.",
      };
    }
    if (lower.includes("pages_manage_posts") || lower.includes("instagram_content_publish")) {
      return {
        message: "Permission de publication manquante sur ton token Meta.",
        hint: "Régénère le token avec les bons scopes (pages_manage_posts, instagram_content_publish).",
      };
    }
    return { message: "Permission Facebook/Instagram manquante pour cette action." };
  }
  if (lower.includes("rate limit") || lower.includes("too many calls") || lower.includes("429")) {
    return {
      message: "Trop de demandes en peu de temps.",
      hint: "Attends quelques minutes et réessaie.",
    };
  }
  if (lower.includes("image_url") || lower.includes("image url")) {
    return {
      message: "Instagram n'a pas pu charger l'image fournie.",
      hint: "L'URL doit être publique en HTTPS.",
    };
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────
  if (lower.includes("openai") || lower.includes("gpt-")) {
    if (lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient")) {
      return {
        message: "Le service IA est temporairement saturé.",
        hint: "Réessaie dans quelques minutes.",
      };
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return {
        message: "L'IA a mis trop de temps à répondre.",
        hint: "Réessaie — c'est souvent ponctuel.",
      };
    }
    return {
      message: "Le moteur IA a renvoyé une erreur.",
      hint: "Réessaie ; si ça persiste, recommence dans 5 minutes.",
    };
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (lower.includes("aucun fournisseur email") || lower.includes("no email provider")) {
    return {
      message: "Aucun service d'envoi d'email connecté.",
      hint: "Ajoute une clé Resend ou SendGrid dans les secrets pour activer l'envoi automatique.",
    };
  }

  // ── DB / Backend ──────────────────────────────────────────────────────────
  if (lower.includes("conversation") && (lower.includes("not found") || lower.includes("introuvable"))) {
    return { message: "Cette conversation n'existe plus." };
  }
  if (lower.includes("database") || lower.includes("pg_") || lower.includes("eai_again")) {
    return {
      message: "Problème temporaire avec la base de données.",
      hint: "Réessaie dans quelques instants.",
    };
  }

  // ── Generic network / HTTP ────────────────────────────────────────────────
  if (
    /^http \d{3}$/i.test(s) ||
    lower.includes("network error") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower === "load failed"
  ) {
    return {
      message: "Problème de connexion réseau temporaire.",
      hint: "Vérifie ta connexion et réessaie dans un instant.",
    };
  }

  // ── Fallback : truncate raw English messages so they don't leak in UI ─────
  if (/[a-z]/.test(s) && !/[éèàùç]/i.test(s)) {
    const clean = s
      .replace(/please read the graph api documentation.*$/i, "")
      .replace(/cannot be loaded due to.*$/i, "")
      .replace(/\bGraph API\b/gi, "Facebook")
      .trim();
    return { message: clean.length > 140 ? clean.slice(0, 140) + "…" : clean };
  }

  return { message: s };
}

function extractMessage(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (raw instanceof Error) return raw.message.trim() || null;
  if (typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  // Try the most specific places first, then fall back.
  const candidates: unknown[] = [
    obj.message,
    obj.detail,
    obj.error,
    pick(obj.error, "message"),
    pick(obj.error, "detail"),
    pick(obj.response, "statusText"),
    pickPath(obj, ["response", "data", "message"]),
    pickPath(obj, ["response", "data", "detail"]),
    pickPath(obj, ["response", "data", "error"]),
    pickPath(obj, ["response", "data", "error", "message"]),
    pickPath(obj, ["data", "message"]),
    pickPath(obj, ["data", "detail"]),
    pickPath(obj, ["data", "error"]),
    pickPath(obj, ["data", "error", "message"]),
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function pick(obj: unknown, key: string): unknown {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}

function pickPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    cur = pick(cur, k);
    if (cur == null) return undefined;
  }
  return cur;
}

/**
 * Format a humanized error as a single string for use with `toast.error`,
 * including the hint when present.
 */
export function humanizeToString(raw: unknown, fallback = "Une erreur est survenue"): string {
  const h = humanizeError(raw);
  if (!h) return fallback;
  return h.hint ? `${h.message}\n${h.hint}` : h.message;
}
