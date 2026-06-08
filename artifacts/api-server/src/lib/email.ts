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

async function getResendConnectorCreds(): Promise<ResendCreds | null> {
  try {
    const conns = await connectors.listConnections({ connector_names: "resend" });
    const conn = conns[0];
    if (!conn) return null;
    // The settings shape (per the connector schema) is { api_key, from_email }.
    // Different SDK versions expose them under slightly different keys — try the
    // common locations defensively.
    const candidates: Array<Record<string, unknown> | undefined> = [
      (conn as Record<string, unknown>)["settings"] as Record<string, unknown> | undefined,
      conn.integration as Record<string, unknown> | undefined,
      conn.metadata as Record<string, unknown> | undefined,
      conn as unknown as Record<string, unknown>,
    ];
    for (const c of candidates) {
      if (!c) continue;
      const apiKey =
        (c["api_key"] as string | undefined) ??
        (c["apiKey"] as string | undefined) ??
        (c["secret"] as string | undefined);
      const fromEmail =
        (c["from_email"] as string | undefined) ??
        (c["fromEmail"] as string | undefined) ??
        (c["from"] as string | undefined);
      if (apiKey && fromEmail) return { apiKey, fromEmail };
    }
    return null;
  } catch (err) {
    logger.warn({ err }, "Failed to read Resend connector settings");
    return null;
  }
}

async function callResend(
  apiKey: string,
  from: string,
  input: SendEmailInput,
  provider: "resend-user" | "resend-connector" | "resend-env"
): Promise<SendEmailResult> {
  const headers: Record<string, string> = {};
  if (input.unsubscribeUrl) {
    // Permet à Gmail/Outlook d'afficher un lien Désinscription natif.
    headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
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
  if (Object.keys(headers).length > 0) body.headers = headers;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { success: true, provider, from, messageId: data.id };
  }
  const errText = await response.text().catch(() => "");
  return { success: false, provider, error: errText.slice(0, 400), from };
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
    const adminCreds = await getResendConnectorCreds();
    const envKey = process.env.RESEND_API_KEY;
    if (adminCreds || envKey) {
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
        if (adminCreds) {
          result = await callResend(
            adminCreds.apiKey,
            input.from || adminCreds.fromEmail,
            input,
            "resend-connector",
          );
        } else {
          const from = input.from || process.env.EMAIL_FROM || "onboarding@resend.dev";
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
  const creds = await getResendConnectorCreds();
  if (creds) {
    return callResend(creds.apiKey, input.from || creds.fromEmail, input, "resend-connector");
  }
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    const from = input.from || process.env.EMAIL_FROM || "onboarding@resend.dev";
    return callResend(envKey, from, input, "resend-env");
  }
  const sg = await trySendgridEnv(input);
  if (sg) return sg;
  return { success: false, provider: "none", error: "Aucun fournisseur email configuré" };
}
