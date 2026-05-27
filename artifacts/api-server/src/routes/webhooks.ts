/**
 * Webhooks publics (pas d'auth utilisateur — sécurisé par signature).
 *
 * Resend envoie : email.sent, email.delivered, email.opened, email.clicked,
 * email.bounced, email.complained, email.delivery_delayed.
 * Doc : https://resend.com/docs/dashboard/webhooks/introduction
 */
import { Router, type IRouter } from "express";
import { Webhook } from "svix";
import { eq, sql } from "drizzle-orm";
import { db, emailCampaigns, emailEvents, type EmailEventType } from "@workspace/db";

const router: IRouter = Router();

// Mapping Resend → notre type interne
function mapEventType(resendType: string): EmailEventType | null {
  switch (resendType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.delivery_delayed":
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    tags?: Array<{ name: string; value: string }> | Record<string, string>;
    [k: string]: unknown;
  };
}

router.post("/webhooks/resend", async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    req.log.warn("Resend webhook called but RESEND_WEBHOOK_SECRET is not set");
    res.status(503).json({ error: "Webhook non configuré." });
    return;
  }

  // express.raw est monté en amont sur cette route — req.body est un Buffer
  // contenant les octets bruts du payload, indispensable pour la signature Svix.
  if (!Buffer.isBuffer(req.body)) {
    req.log.error("Resend webhook: req.body is not a Buffer (raw parser missing)");
    res.status(500).json({ error: "Mauvaise configuration serveur." });
    return;
  }
  const rawBody = req.body.toString("utf8");

  const headers = {
    "svix-id": String(req.headers["svix-id"] ?? ""),
    "svix-timestamp": String(req.headers["svix-timestamp"] ?? ""),
    "svix-signature": String(req.headers["svix-signature"] ?? ""),
  };
  let payload: ResendWebhookPayload;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, headers) as ResendWebhookPayload;
  } catch (err) {
    req.log.warn({ err }, "Resend webhook signature invalid");
    res.status(401).json({ error: "Signature invalide." });
    return;
  }

  const eventType = mapEventType(payload.type ?? "");
  if (!eventType) {
    res.json({ ok: true, ignored: true });
    return;
  }
  const data = payload.data ?? {};
  const messageId = data.email_id ?? null;
  const to = Array.isArray(data.to) ? data.to[0] : data.to;
  if (!to || !messageId) {
    res.json({ ok: true, ignored: true });
    return;
  }

  // Récupère campaign_id depuis les tags Resend
  let campaignId: number | null = null;
  const tags = data.tags;
  if (Array.isArray(tags)) {
    const tag = tags.find((t) => t.name === "campaign_id");
    if (tag) campaignId = Number(tag.value);
  } else if (tags && typeof tags === "object") {
    const v = (tags as Record<string, string>)["campaign_id"];
    if (v) campaignId = Number(v);
  }
  if (!campaignId || !Number.isFinite(campaignId)) {
    res.json({ ok: true, ignored: true });
    return;
  }

  // Insert idempotent : si Resend renvoie le même event (même messageId+type),
  // l'unique index `email_events_message_type_unique_idx` fait que rien n'est
  // inséré et `inserted.length === 0`. On n'incrémente alors PAS les compteurs.
  const inserted = await db
    .insert(emailEvents)
    .values({
      campaignId,
      contactEmail: String(to).toLowerCase(),
      type: eventType,
      resendMessageId: messageId,
      payload: data as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [emailEvents.resendMessageId, emailEvents.type],
    })
    .returning({ id: emailEvents.id });

  if (inserted.length > 0) {
    if (eventType === "opened") {
      await db
        .update(emailCampaigns)
        .set({ openCount: sql`${emailCampaigns.openCount} + 1` })
        .where(eq(emailCampaigns.id, campaignId));
    } else if (eventType === "clicked") {
      await db
        .update(emailCampaigns)
        .set({ clickCount: sql`${emailCampaigns.clickCount} + 1` })
        .where(eq(emailCampaigns.id, campaignId));
    }
  }

  res.json({ ok: true, deduped: inserted.length === 0 });
});

export default router;
