/**
 * Translate raw provider error messages (Meta Graph API, email providers, etc.)
 * into short, friendly French messages with a hint on what to do next.
 *
 * Used at display time so it also cleans up errors already persisted in the DB.
 */

type Humanized = { message: string; hint?: string };

export function humanizeError(raw: string | null | undefined): Humanized | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  // ── Meta Graph API ────────────────────────────────────────────────────────
  if (
    lower.includes("does not exist") &&
    lower.includes("missing permissions")
  ) {
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
    return {
      message: "Permission Facebook/Instagram manquante pour cette action.",
    };
  }
  if (lower.includes("rate limit") || lower.includes("too many calls")) {
    return {
      message: "Facebook limite temporairement les requêtes.",
      hint: "Réessaie dans quelques minutes.",
    };
  }
  if (lower.includes("image_url") || lower.includes("image url")) {
    return {
      message: "Instagram n'a pas pu charger l'image fournie.",
      hint: "L'URL doit être publique en HTTPS.",
    };
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (lower.includes("aucun fournisseur email")) {
    return {
      message: "Aucun service d'envoi d'email connecté.",
      hint: "Ajoute une clé Resend ou SendGrid dans les secrets pour activer l'envoi automatique.",
    };
  }

  // ── Generic network / HTTP ────────────────────────────────────────────────
  if (/^http \d{3}$/i.test(s) || lower.includes("network error") || lower.includes("fetch failed")) {
    return {
      message: "Problème de connexion réseau temporaire.",
      hint: "Réessaie dans un instant.",
    };
  }

  // ── Fallback : truncate raw English messages so they don't leak in UI ─────
  if (/[a-z]/.test(s) && !/[éèàùç]/i.test(s)) {
    // looks English — keep short, no API jargon
    const clean = s
      .replace(/please read the graph api documentation.*$/i, "")
      .replace(/cannot be loaded due to.*$/i, "")
      .replace(/\bGraph API\b/gi, "Facebook")
      .trim();
    return {
      message: clean.length > 140 ? clean.slice(0, 140) + "…" : clean,
    };
  }

  return { message: s };
}
