/**
 * Public contact form route.
 * Receives messages from the /contact page and forwards them to contact@growiq.tech via Resend.
 */
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { Resend } from "resend";

const router: IRouter = Router();

const contactSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200),
  email: z.string().email("Email invalide").max(200),
  subject: z.string().max(300).optional(),
  message: z.string().min(1, "Le message est requis").max(5000),
});

// Simple rate limit in-memory (par IP, max 5 messages / 10 min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

router.post("/api/contact", async (req, res) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Trop de messages envoyés. Réessayez dans quelques minutes." });
    return;
  }

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }

  const { name, email, subject, message } = parsed.data;

  try {
    // Try Resend if available, otherwise log to console
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "GrowIQ Contact <noreply@growiq.tech>",
        to: ["contact@growiq.tech"],
        replyTo: email,
        subject: `[Contact GrowIQ] ${subject || "Nouveau message"}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #5B54D6;">Nouveau message de contact</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #666; width: 80px;"><strong>Nom</strong></td><td>${escapeHtml(name)}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Email</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
              ${subject ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Sujet</strong></td><td>${escapeHtml(subject)}</td></tr>` : ""}
            </table>
            <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-top: 16px; white-space: pre-wrap;">${escapeHtml(message)}</div>
          </div>
        `,
        text: `Nouveau message de contact\n\nNom: ${name}\nEmail: ${email}\nSujet: ${subject || "—"}\n\nMessage:\n${message}`,
      });
    } else {
      // Fallback: log to console (visible in Replit logs)
      console.log("[CONTACT FORM]", { name, email, subject, message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[CONTACT FORM ERROR]", err);
    res.status(500).json({ error: "Impossible d'envoyer le message. Réessayez plus tard." });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;
