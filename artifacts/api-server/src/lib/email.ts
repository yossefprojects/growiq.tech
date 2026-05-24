// Email sending helper — uses the Replit Resend connector (api_key + from_email
// configured by the user) and falls back to env keys if the connector is missing.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const connectors = new ReplitConnectors();

export interface SendEmailInput {
  to: string[];
  subject: string;
  body: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  provider: "resend-connector" | "resend-env" | "sendgrid-env" | "none";
  error?: string;
  from?: string;
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
  provider: "resend-connector" | "resend-env"
): Promise<SendEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.body }),
  });
  if (response.ok) return { success: true, provider, from };
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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // 1) Replit Resend connector (preferred — uses the user's configured from_email).
  const creds = await getResendConnectorCreds();
  if (creds) {
    return callResend(creds.apiKey, input.from || creds.fromEmail, input, "resend-connector");
  }
  // 2) Raw RESEND_API_KEY env var.
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    const from = input.from || process.env.EMAIL_FROM || "onboarding@resend.dev";
    return callResend(envKey, from, input, "resend-env");
  }
  // 3) SendGrid fallback.
  const sg = await trySendgridEnv(input);
  if (sg) return sg;
  return { success: false, provider: "none", error: "Aucun fournisseur email configuré" };
}
