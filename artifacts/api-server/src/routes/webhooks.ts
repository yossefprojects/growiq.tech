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
import { getUserIntegration } from "../lib/user-integrations";

const router: IRouter = Router();

// Extrait la valeur d'un tag (campaign_id, user_id) depuis le payload Resend.
// Resend renvoie les tags soit en tableau [{name,value}] soit en objet {name:value}.
function readTag(tags: unknown, name: string): string | null {
  if (Array.isArray(tags)) {
    const t = tags.find((x) => x && typeof x === "object" && (x as { name?: string }).name === name);
    const v = t ? (t as { value?: string }).value : undefined;
    return v != null ? String(v) : null;
  }
  if (tags && typeof tags === "object") {
    const v = (tags as Record<string, unknown>)[name];
    return v != null ? String(v) : null;
  }
  return null;
}

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
  // express.raw est monté en amont sur cette route — req.body est un Buffer
  // contenant les octets bruts du payload, indispensable pour la signature Svix.
  if (!Buffer.isBuffer(req.body)) {
    req.log.error("Resend webhook: req.body is not a Buffer (raw parser missing)");
    res.status(500).json({ error: "Mauvaise configuration serveur." });
    return;
  }
  const rawBody = req.body.toString("utf8");

  // Multi-tenant : chaque user a SON compte Resend, donc SON secret de webhook.
  // On lit (sans confiance) le tag user_id dans le payload pour choisir le bon
  // secret. La signature reste vérifiée ensuite — un payload forgé sans le secret
  // de l'user échouera. Fallback sur le secret global (compte GrowIQ partagé).
  let userWebhookSecret: string | null = null;
  try {
    const preview = JSON.parse(rawBody) as ResendWebhookPayload;
    const tagUserId = readTag(preview.data?.tags, "user_id");
    if (tagUserId) {
      const conn = await getUserIntegration(tagUserId, "resend");
      userWebhookSecret = conn?.metadata?.resendWebhookSecret ?? null;
    }
  } catch {
    // payload non-JSON → on tombera sur le secret global ci-dessous
  }
  const secret = userWebhookSecret ?? process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    req.log.warn("Resend webhook called but no signing secret configured (per-user nor env)");
    res.status(503).json({ error: "Webhook non configuré." });
    return;
  }

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

  // Isolation multi-tenant : la signature prouve seulement que le payload vient
  // d'un compte Resend connu, PAS que campaign_id appartient à l'expéditeur.
  // Sans ce contrôle, l'user A (qui connaît son propre whsec) pourrait signer un
  // event valide ciblant la campagne de l'user B et gonfler ses stats. On lie donc
  // la campagne au tenant vérifié avant toute écriture.
  const verifiedUserId = readTag(payload.data?.tags, "user_id");
  const [campaign] = await db
    .select({ id: emailCampaigns.id, userId: emailCampaigns.userId })
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) {
    res.json({ ok: true, ignored: true });
    return;
  }
  if (userWebhookSecret) {
    // Event authentifié avec le secret PERSO d'un user → la campagne DOIT lui
    // appartenir, sinon c'est une tentative d'injection cross-tenant.
    if (!verifiedUserId || campaign.userId !== verifiedUserId) {
      req.log.warn(
        { campaignId, verifiedUserId, ownerId: campaign.userId },
        "Resend webhook: cross-tenant mismatch rejected",
      );
      res.status(403).json({ error: "Campagne hors périmètre." });
      return;
    }
  } else if (verifiedUserId && campaign.userId && campaign.userId !== verifiedUserId) {
    // Secret partagé GrowIQ (freemium) : si un tag user_id est présent il doit
    // correspondre au propriétaire de la campagne.
    req.log.warn(
      { campaignId, verifiedUserId, ownerId: campaign.userId },
      "Resend webhook (shared secret): user_id tag mismatch rejected",
    );
    res.status(403).json({ error: "Campagne hors périmètre." });
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
