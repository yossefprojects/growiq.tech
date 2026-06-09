// Email sending helper.
//
// Ordre de résolution des credentials (du plus prioritaire au moins) :
//   1. Si `userId` fourni → on regarde `user_integrations` (platform=resend) :
//      l'utilisateur a configuré SA clé Resend et SON domaine d'envoi.
//      Pas de quota côté GrowIQ — c'est son compte Resend qui paie.
//   2. Si `userId` fourni mais pas de clé perso → on tente la clé admin
//      partagée (Replit Connector Resend) avec décompte du quota freemium
//      (100 emails/mois) via `reserveEmailsFromQuota`. Refusé si dépassé.
//   3. Pas de userId (envois système : notifications agency à l'admin) →
//      Replit Connector Resend brut, sans quota.
//   4. Fallback RESEND_API_KEY env, puis SendGrid env (legacy).
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";
import { getUserIntegration } from "./user-integrations";
import {
  refundEmailsToQuota,
  reserveEmailsFromQuota,
} from "./email-usage";

const connectors = new ReplitConnectors();

// Adresse expéditeur partagée GrowIQ — un domaine vérifié chez Resend
// (ex. "GrowIQ <contact@growiq.tech>"). Préférée à l'adresse du connector pour
// les envois freemium/système : le connector pointe sur une adresse Gmail que
// Resend refuse (domaine non vérifiable). Une adresse vérifiée ici débloque
// l'envoi gratuit partagé pour tous les utilisateurs.
const SHARED_FROM = process.env.RESEND_SHARED_FROM?.trim() || null;

export interface SendEmailInput {
  to: string[];
  subject: string;
  body: string;
  // HTML optionnel. Si présent, Resend l'envoie en plus du texte plain et active
  // le tracking d'ouverture (pixel) + de clics (rewrite des liens).
  html?: string;
  from?: string;
  // Tags propagés à Resend pour le filtrage en dashboard / webhooks.
  // Format Resend : { name, value }
  tags?: Array<{ name: string; value: string }>;
  // Permet à l'utilisateur de se désinscrire en un clic (RFC 8058).
  unsubscribeUrl?: string;
  // Pièces jointes : contenu encodé en base64 (sans préfixe data:).
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  // Si fourni : on cherche la clé Resend perso de l'user, puis fallback freemium
  // admin avec décompte du quota mensuel (100/mois).
  userId?: string;
}

export interface SendEmailResult {
  success: boolean;
  provider: "resend-user" | "resend-connector" | "resend-env" | "sendgrid-env" | "none";
  error?: string;
  from?: string;
  // ID Resend du message envoyé, utilisé pour matcher les webhooks.
  messageId?: string;
  // True si l'envoi a été refusé parce que le quota mensuel freemium est atteint
  // (l'UI peut alors afficher "Connecte ta propre clé Resend").
  quotaExceeded?: boolean;
  quotaUsed?: number;
  quotaLimit?: number;
}

interface ResendCreds {
  apiKey: string;
  fromEmail: string;
}

// Le connecteur Resend de Replit (SDK @replit/connectors-sdk) n'expose PAS la clé
// API en clair : `listConnections` ne renvoie jamais `settings.api_key` (les
// valeurs `expand=settings|credentials` sont rejetées en 400). La seule manière
// supportée d'utiliser le connecteur est son PROXY (`connectors.proxy(...)`), qui
// injecte l'Authorization côté Replit. On envoie donc les emails "connector" via
// ce proxy plutôt qu'en lisant la clé. (Bug historique : l'ancien code cherchait
// `settings.api_key` qui était toujours absent → "Aucun fournisseur" en dev ET prod.)
async function connectorResendAvailable(): Promise<boolean> {
  try {
    const conns = await connectors.listConnections({ connector_names: "resend" });
    return conns.length > 0;
  } catch (err) {
    logger.warn({ err }, "Failed to list Resend connector");
    return false;
  }
}

// Construit le corps JSON attendu par l'API Resend (/emails), partagé entre
// l'envoi direct (clé en clair) et l'envoi via proxy connecteur.
function buildResendBody(from: string, input: SendEmailInput): Record<string, unknown> {
  const customHeaders: Record<string, string> = {};
  if (input.unsubscribeUrl) {
    // Permet à Gmail/Outlook d'afficher un lien Désinscription natif.
    customHeaders["List-Unsubscribe"] = `<${input.unsubscribeUrl}>`;
    customHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const body: Record<string, unknown> = {
    from,
    to: input.to,
    subject: input.subject,
    text: input.body,
  };
  if (input.html) body.html = input.html;
  if (input.tags && input.tags.length > 0) body.tags = input.tags;
  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      ...(a.contentType ? { content_type: a.contentType } : {}),
    }));
  }
  if (Object.keys(customHeaders).length > 0) body.headers = customHeaders;
  return body;
}

async function parseResendResponse(
  response: Response,
  from: string,
  provider: "resend-user" | "resend-connector" | "resend-env"
): Promise<SendEmailResult> {
  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { success: true, provider, from, messageId: data.id };
  }
  const errText = await response.text().catch(() => "");
  return { success: false, provider, error: errText.slice(0, 400), from };
}

// Envoi direct avec une clé API Resend en clair (clé perso de l'user ou RESEND_API_KEY env).
async function callResend(
  apiKey: string,
  from: string,
  input: SendEmailInput,
  provider: "resend-user" | "resend-connector" | "resend-env"
): Promise<SendEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildResendBody(from, input)),
  });
  return parseResendResponse(response, from, provider);
}

// Envoi via le proxy du connecteur Resend (clé injectée par Replit, jamais extraite).
async function sendViaResendProxy(
  from: string,
  input: SendEmailInput
): Promise<SendEmailResult> {
  try {
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: buildResendBody(from, input),
    });
    return parseResendResponse(response, from, "resend-connector");
  } catch (err) {
    logger.warn({ err }, "Resend proxy send failed");
    return {
      success: false,
      provider: "resend-connector",
      error: err instanceof Error ? err.message.slice(0, 400) : "Erreur proxy Resend",
      from,
    };
  }
}

async function trySendgridEnv(input: SendEmailInput): Promise<SendEmailResult | null> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return null;
  const from = input.from || process.env.EMAIL_FROM || "noreply@example.com";
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: input.to.map((email) => ({ to: [{ email }] })),
      from: { email: from.replace(/^.*<|>$/g, "") || "noreply@example.com", name: "Agent Marketing IA" },
      subject: input.subject,
      content: [{ type: "text/plain", value: input.body }],
    }),
  });
  if (response.ok) return { success: true, provider: "sendgrid-env", from };
  const errText = await response.text().catch(() => "");
  return { success: false, provider: "sendgrid-env", error: errText.slice(0, 400), from };
}

/**
 * Lit la clé Resend perso de l'utilisateur dans `user_integrations`.
 * Retourne null si l'user n'a pas configuré sa propre clé.
 */
async function getUserResendCreds(userId: string): Promise<ResendCreds | null> {
  const conn = await getUserIntegration(userId, "resend");
  if (!conn || conn.status !== "active") return null;
  const fromEmail = conn.metadata?.fromEmail ?? conn.accountLabel ?? null;
  if (!conn.accessToken || !fromEmail) return null;
  return { apiKey: conn.accessToken, fromEmail };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipientCount = input.to.length || 1;

  // 1) Clé Resend per-user (priorité absolue — pas de quota GrowIQ).
  if (input.userId) {
    const userCreds = await getUserResendCreds(input.userId);
    if (userCreds) {
      return callResend(
        userCreds.apiKey,
        input.from || userCreds.fromEmail,
        input,
        "resend-user",
      );
    }

    // 2) Pas de clé perso → tenter la clé admin partagée AVEC quota freemium.
    //    En priorité le proxy du connecteur Resend ; sinon RESEND_API_KEY env.
    const hasConnector = await connectorResendAvailable();
    const envKey = process.env.RESEND_API_KEY;
    if (hasConnector || envKey) {
      const reservation = await reserveEmailsFromQuota(input.userId, recipientCount);
      if (!reservation.allowed) {
        return {
          success: false,
          provider: "none",
          error: `Quota mensuel atteint (${reservation.used}/${reservation.quota}). Connecte ta propre clé Resend dans "Mes outils" pour continuer.`,
          quotaExceeded: true,
          quotaUsed: reservation.used,
          quotaLimit: reservation.quota,
        };
      }
      try {
        let result: SendEmailResult;
        if (hasConnector) {
          const from = input.from || SHARED_FROM || process.env.EMAIL_FROM || "onboarding@resend.dev";
          result = await sendViaResendProxy(from, input);
        } else {
          const from = input.from || SHARED_FROM || process.env.EMAIL_FROM || "onboarding@resend.dev";
          result = await callResend(envKey!, from, input, "resend-env");
        }
        // Si l'envoi échoue après réservation, on rend les emails au quota.
        if (!result.success) {
          await refundEmailsToQuota(input.userId, recipientCount);
        }
        return result;
      } catch (err) {
        await refundEmailsToQuota(input.userId, recipientCount);
        throw err;
      }
    }
  }

  // 3) Pas de userId → envois système (notifications admin). Pas de quota.
  if (await connectorResendAvailable()) {
    const from = input.from || SHARED_FROM || process.env.EMAIL_FROM || "onboarding@resend.dev";
    return sendViaResendProxy(from, input);
  }
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    const from = input.from || SHARED_FROM || process.env.EMAIL_FROM || "onboarding@resend.dev";
    return callResend(envKey, from, input, "resend-env");
  }
  const sg = await trySendgridEnv(input);
  if (sg) return sg;
  return { success: false, provider: "none", error: "Aucun fournisseur email configuré" };
}
