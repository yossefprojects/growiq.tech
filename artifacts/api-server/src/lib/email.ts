// Email sending helper — uses Replit Resend connector first, falls back to env keys.
// Resend's "onboarding@resend.dev" is the default sandbox sender that works
// immediately without DNS / domain verification.
import { ReplitConnectors } from "@replit/connectors-sdk";

const DEFAULT_FROM = process.env.EMAIL_FROM || "Marketing Agent <onboarding@resend.dev>";
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
}

async function tryResendConnector(input: SendEmailInput): Promise<SendEmailResult | null> {
  try {
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: input.from || DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        text: input.body,
      }),
    });
    if (response.ok) return { success: true, provider: "resend-connector" };
    const errText = await response.text().catch(() => "");
    return { success: false, provider: "resend-connector", error: errText.slice(0, 300) };
  } catch (_e) {
    // Connector not configured → signal caller to try fallback
    return null;
  }
}

async function tryResendEnv(input: SendEmailInput): Promise<SendEmailResult | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: input.from || DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      text: input.body,
    }),
  });
  if (response.ok) return { success: true, provider: "resend-env" };
  const errText = await response.text().catch(() => "");
  return { success: false, provider: "resend-env", error: errText.slice(0, 300) };
}

async function trySendgridEnv(input: SendEmailInput): Promise<SendEmailResult | null> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: input.to.map((email) => ({ to: [{ email }] })),
      from: { email: (input.from || DEFAULT_FROM).replace(/^.*<|>$/g, "") || "noreply@example.com", name: "Marketing Agent IA" },
      subject: input.subject,
      content: [{ type: "text/plain", value: input.body }],
    }),
  });
  if (response.ok) return { success: true, provider: "sendgrid-env" };
  const errText = await response.text().catch(() => "");
  return { success: false, provider: "sendgrid-env", error: errText.slice(0, 300) };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendC = await tryResendConnector(input);
  if (resendC) return resendC;
  const resendE = await tryResendEnv(input);
  if (resendE) return resendE;
  const sg = await trySendgridEnv(input);
  if (sg) return sg;
  return { success: false, provider: "none", error: "Aucun fournisseur email configuré" };
}
