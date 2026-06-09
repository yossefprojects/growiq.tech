/**
 * Email marketing routes — contacts CRUD + campagnes (génération IA + envoi Resend).
 *
 * Tradeoffs (intentionnels) :
 *   - Envoi synchrone via boucle (Resend permet 1 to[] par appel, on parallèle limité).
 *   - Stats lues live depuis email_events (pas de cache) — OK tant qu'on n'a pas
 *     des millions d'événements.
 *   - Pas de programmation différée pour l'instant : `scheduledFor` est stocké
 *     mais l'envoi est immédiat.
 *   - Tous les contacts/campagnes sont scopés par userId.
 */
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  emailContacts,
  emailCampaigns,
  emailEvents,
  insertEmailContactSchema,
  type EmailCampaignBrief,
  type EmailCampaignStatus,
  type EmailWritingStyle,
  type EmailAttachment,
} from "@workspace/db";
import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { AuthedRequest } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { uploadPublicBuffer, downloadPublicObject } from "../lib/objectStorage";
import { getUserIntegration } from "../lib/user-integrations";

function uid(req: Request): string {
  return (req as AuthedRequest).userId;
}

const router: IRouter = Router();

// ── Contacts CRUD ───────────────────────────────────────────────────────────

router.get("/email/contacts", async (req, res) => {
  const userId = uid(req);
  const rows = await db
    .select()
    .from(emailContacts)
    .where(eq(emailContacts.userId, userId))
    .orderBy(desc(emailContacts.createdAt));
  res.json(rows);
});

router.post("/email/contacts", async (req, res) => {
  const userId = uid(req);
  const parsed = insertEmailContactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  try {
    const [row] = await db
      .insert(emailContacts)
      .values({
        userId,
        email: parsed.data.email.toLowerCase().trim(),
        firstName: parsed.data.firstName ?? "",
        lastName: parsed.data.lastName ?? "",
        tags: parsed.data.tags ?? [],
        source: parsed.data.source ?? "manual",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("email_contacts_user_email_unique")) {
      res.status(409).json({ error: "Ce contact existe déjà." });
      return;
    }
    req.log.error({ err }, "create contact failed");
    res.status(500).json({ error: "Impossible d'ajouter ce contact." });
  }
});

const bulkImportSchema = z.object({
  contacts: z
    .array(
      z.object({
        email: z.string().email(),
        firstName: z.string().max(120).optional(),
        lastName: z.string().max(120).optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(5000),
});

router.post("/email/contacts/bulk", async (req, res) => {
  const userId = uid(req);
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const values = parsed.data.contacts.map((c) => ({
    userId,
    email: c.email.toLowerCase().trim(),
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    tags: c.tags ?? [],
    source: "csv-import",
  }));
  // Déduplique en mémoire pour éviter les conflits intra-batch.
  const seen = new Set<string>();
  const deduped = values.filter((v) => {
    if (seen.has(v.email)) return false;
    seen.add(v.email);
    return true;
  });
  const inserted = await db
    .insert(emailContacts)
    .values(deduped)
    .onConflictDoNothing({
      target: [emailContacts.userId, emailContacts.email],
    })
    .returning();
  res.json({
    requested: parsed.data.contacts.length,
    inserted: inserted.length,
    skipped: parsed.data.contacts.length - inserted.length,
  });
});

router.delete("/email/contacts/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  await db
    .delete(emailContacts)
    .where(and(eq(emailContacts.userId, userId), eq(emailContacts.id, id)));
  res.json({ ok: true });
});

// ── Campagnes : génération IA ───────────────────────────────────────────────

const generateSchema = z.object({
  product: z.string().min(1).max(2000),
  audience: z.string().min(1).max(2000),
  objective: z.string().min(1).max(2000),
  tone: z.string().max(120).optional(),
  style: z.enum(["vouvoiement", "tutoiement"]).optional(),
  name: z.string().max(200).optional(),
});

function styleInstruction(style: EmailWritingStyle): string {
  return style === "tutoiement"
    ? `Adresse-toi au destinataire au TUTOIEMENT : utilise "tu", "ton", "ta", "tes". Ton chaleureux et proche. N'emploie JAMAIS "vous", "votre", "vos".`
    : `Adresse-toi au destinataire au VOUVOIEMENT : utilise "vous", "votre", "vos". Ton professionnel, courtois et chaleureux. N'emploie JAMAIS "tu", "ton", "ta", "tes".`;
}

interface GeneratedEmail {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

async function generateEmailWithAI(
  brief: EmailCampaignBrief,
  style: EmailWritingStyle,
): Promise<GeneratedEmail> {
  const prompt = `Tu es un expert en email marketing francophone.
Rédige UN email pour cette campagne. Réponds STRICTEMENT en JSON :
{"subject": "...", "bodyText": "...", "bodyHtml": "..."}

Règles :
- Sujet court (max 60 caractères), accrocheur, sans clickbait.
- bodyText : version texte plain, lisible, sans markdown.
- bodyHtml : HTML simple et propre (<p>, <h2>, <a>, <strong>). Pas de CSS inline complexe.
- ${styleInstruction(style)}
- Ton général : ${brief.tone || "chaleureux et naturel"}.
- Termine par une signature simple et un PS si pertinent.

Brief :
- Produit / message : ${brief.product}
- Cible : ${brief.audience}
- Objectif : ${brief.objective}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<GeneratedEmail>;
  if (!parsed.subject || !parsed.bodyText || !parsed.bodyHtml) {
    throw new Error("IA a renvoyé un email incomplet");
  }
  return {
    subject: String(parsed.subject).slice(0, 200),
    bodyText: String(parsed.bodyText),
    bodyHtml: String(parsed.bodyHtml),
  };
}

router.post("/email/campaigns/generate", async (req, res) => {
  const userId = uid(req);
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Brief invalide", details: parsed.error.flatten() });
    return;
  }
  const style: EmailWritingStyle = parsed.data.style ?? "vouvoiement";
  const brief: EmailCampaignBrief = {
    product: parsed.data.product,
    audience: parsed.data.audience,
    objective: parsed.data.objective,
    tone: parsed.data.tone,
    style,
  };
  try {
    const ai = await generateEmailWithAI(brief, style);
    const [row] = await db
      .insert(emailCampaigns)
      .values({
        userId,
        name: parsed.data.name || `Campagne du ${new Date().toLocaleDateString("fr-FR")}`,
        subject: ai.subject,
        bodyHtml: ai.bodyHtml,
        bodyText: ai.bodyText,
        brief,
        status: "draft" as EmailCampaignStatus,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "generate email campaign failed");
    res.status(500).json({ error: "Impossible de générer l'email. Réessaie." });
  }
});

// ── Campagnes : list / get / update / delete ────────────────────────────────

router.get("/email/campaigns", async (req, res) => {
  const userId = uid(req);
  const rows = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.userId, userId))
    .orderBy(desc(emailCampaigns.createdAt));
  res.json(rows);
});

router.get("/email/campaigns/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const [row] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  if (!row) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  // Stats live : nombre d'événements par type
  const events = await db
    .select({ type: emailEvents.type, count: sql<number>`count(*)::int` })
    .from(emailEvents)
    .where(eq(emailEvents.campaignId, id))
    .groupBy(emailEvents.type);
  const stats: Record<string, number> = {};
  for (const e of events) stats[e.type] = e.count;
  res.json({ ...row, stats });
});

const updateCampaignSchema = z.object({
  name: z.string().max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().min(1).optional(),
  bodyText: z.string().optional(),
});

router.patch("/email/campaigns/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const parsed = updateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [row] = await db
    .update(emailCampaigns)
    .set(parsed.data)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  res.json(row);
});

router.delete("/email/campaigns/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  // Garde anti-suppression accidentelle : une campagne déjà envoyée (ou en cours
  // d'envoi) ne peut PAS être supprimée — sinon on perd l'historique et les stats.
  // Seuls les brouillons et les envois totalement échoués sont supprimables.
  // Suppression ATOMIQUE : le DELETE filtre directement sur le statut, ce qui
  // évite une race avec une transition d'envoi (draft -> sending) qui pourrait
  // se glisser entre un SELECT et un DELETE séparés.
  const deleted = await db
    .delete(emailCampaigns)
    .where(
      and(
        eq(emailCampaigns.userId, userId),
        eq(emailCampaigns.id, id),
        inArray(emailCampaigns.status, ["draft", "failed"]),
      ),
    )
    .returning({ id: emailCampaigns.id });
  if (deleted.length > 0) {
    res.json({ ok: true });
    return;
  }
  // Rien supprimé : soit la campagne n'existe pas, soit son statut la protège.
  const [existing] = await db
    .select({ status: emailCampaigns.status })
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  if (!existing) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  res.status(409).json({
    error:
      "Cette campagne a déjà été envoyée : elle est conservée dans ton historique et ne peut pas être supprimée.",
    status: existing.status,
  });
});

// ── Expéditeur (adresse "from") ─────────────────────────────────────────────

// Parse une adresse "from" du type "GrowIQ <contact@growiq.tech>" ou
// "contact@growiq.tech" en { name, email }.
function parseSharedFrom(raw: string | undefined): { name: string | null; email: string | null } {
  const value = raw?.trim();
  if (!value) return { name: null, email: null };
  const m = value.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || null, email: m[2] || null };
  return { name: null, email: value };
}

router.get("/email/sender", async (req, res) => {
  const userId = uid(req);
  const conn = await getUserIntegration(userId, "resend");
  const usingOwnKey = !!conn && conn.status === "active";
  const shared = parseSharedFrom(process.env.RESEND_SHARED_FROM);
  res.json({
    usingOwnKey,
    fromEmail: usingOwnKey ? conn?.metadata?.fromEmail ?? null : shared.email,
    fromName: usingOwnKey ? conn?.metadata?.fromName ?? null : shared.name,
  });
});

// ── Campagnes : pièces jointes ──────────────────────────────────────────────

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 Mo par fichier

const attachmentSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(150).optional(),
  // Contenu encodé en base64 (sans le préfixe "data:...;base64,").
  dataBase64: z.string().min(1),
});

router.post("/email/campaigns/:id/attachments", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const parsed = attachmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Fichier invalide" });
    return;
  }

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  if (!campaign) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  if ((campaign.attachments?.length ?? 0) >= MAX_ATTACHMENTS) {
    res.status(400).json({ error: `Maximum ${MAX_ATTACHMENTS} pièces jointes par email.` });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.dataBase64, "base64");
  } catch {
    res.status(400).json({ error: "Fichier illisible" });
    return;
  }
  if (buffer.length === 0) {
    res.status(400).json({ error: "Fichier vide" });
    return;
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    res.status(400).json({ error: "Fichier trop lourd (10 Mo maximum)." });
    return;
  }

  const safeName = parsed.data.filename.replace(/[/\\]/g, "_").slice(0, 200);
  const dotIdx = safeName.lastIndexOf(".");
  const ext = dotIdx > 0 ? safeName.slice(dotIdx + 1).toLowerCase() : "bin";
  const contentType = parsed.data.contentType || "application/octet-stream";

  let uploaded: { relativePath: string };
  try {
    uploaded = await uploadPublicBuffer(buffer, { ext, contentType });
  } catch (err) {
    req.log.error({ err }, "attachment upload failed");
    res.status(500).json({ error: "Impossible d'enregistrer le fichier. Réessaie." });
    return;
  }

  const newAttachment: EmailAttachment = {
    filename: safeName,
    path: uploaded.relativePath,
    contentType,
    size: buffer.length,
  };
  const attachments = [...(campaign.attachments ?? []), newAttachment];
  const [row] = await db
    .update(emailCampaigns)
    .set({ attachments })
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)))
    .returning();
  res.status(201).json(row);
});

router.delete("/email/campaigns/:id/attachments/:index", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  const index = Number(req.params.index);
  if (!Number.isFinite(id) || !Number.isInteger(index) || index < 0) {
    res.status(400).json({ error: "Paramètres invalides" });
    return;
  }
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  if (!campaign) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  const current = campaign.attachments ?? [];
  if (index >= current.length) {
    res.status(404).json({ error: "Pièce jointe introuvable" });
    return;
  }
  const attachments = current.filter((_, i) => i !== index);
  const [row] = await db
    .update(emailCampaigns)
    .set({ attachments })
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)))
    .returning();
  res.json(row);
});

// ── Campagnes : envoi ───────────────────────────────────────────────────────

const sendSchema = z.object({
  // Soit on cible des contacts spécifiques par ID, soit "tous", soit par tag.
  contactIds: z.array(z.number().int()).optional(),
  tag: z.string().optional(),
  allSubscribed: z.boolean().optional(),
});

router.post("/email/campaigns/:id/send", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const parsed = sendSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Sélection invalide" });
    return;
  }

  // Transition atomique : on passe `draft` ou `partially_failed` à `sending`
  // en UNE seule requête. Si la condition échoue (autre requête simultanée,
  // statut `sending`/`sent`/`failed`), on renvoie 409 sans rien faire d'autre.
  // C'est la garde anti double-envoi.
  const [campaign] = await db
    .update(emailCampaigns)
    .set({ status: "sending" })
    .where(
      and(
        eq(emailCampaigns.userId, userId),
        eq(emailCampaigns.id, id),
        sql`${emailCampaigns.status} IN ('draft', 'partially_failed')`,
      ),
    )
    .returning();
  if (!campaign) {
    // Soit la campagne n'existe pas / n'est pas à l'user, soit elle est déjà
    // en cours / envoyée. Un SELECT pour différencier l'erreur.
    const [existing] = await db
      .select({ status: emailCampaigns.status })
      .from(emailCampaigns)
      .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
    if (!existing) {
      res.status(404).json({ error: "Campagne introuvable" });
      return;
    }
    res.status(409).json({
      error: "Cette campagne est déjà en cours d'envoi ou terminée.",
      status: existing.status,
    });
    return;
  }

  try {
    // Résoudre la liste de destinataires
    const conds = [eq(emailContacts.userId, userId), eq(emailContacts.subscribed, true)];
    let recipients = await db
      .select()
      .from(emailContacts)
      .where(and(...conds));
    if (parsed.data.contactIds && parsed.data.contactIds.length > 0) {
      const ids = new Set(parsed.data.contactIds);
      recipients = recipients.filter((c) => ids.has(c.id));
    } else if (parsed.data.tag) {
      const tag = parsed.data.tag;
      recipients = recipients.filter((c) => c.tags.includes(tag));
    } else if (!parsed.data.allSubscribed) {
      // Aucun filtre + pas de allSubscribed → on refuse pour éviter d'envoyer
      // accidentellement à TOUTE la base.
      throw new Error(
        "Sélectionne des contacts, un tag, ou coche \"tous les abonnés\".",
      );
    }

    // Sur retry (partially_failed → sending), on exclut les contacts qui ont
    // DÉJÀ reçu cette campagne avec succès (event 'sent' présent).
    const alreadySentRows = await db
      .select({ email: emailEvents.contactEmail })
      .from(emailEvents)
      .where(and(eq(emailEvents.campaignId, id), eq(emailEvents.type, "sent")));
    const alreadySent = new Set(alreadySentRows.map((r) => r.email));
    if (alreadySent.size > 0) {
      recipients = recipients.filter((c) => !alreadySent.has(c.email));
    }

    if (recipients.length === 0) {
      throw new Error("Aucun destinataire à qui envoyer.");
    }

    await db
      .update(emailCampaigns)
      .set({ recipientCount: (campaign.recipientCount ?? 0) + recipients.length })
      .where(eq(emailCampaigns.id, id));

    // Pièces jointes : on les télécharge UNE fois depuis le bucket et on les
    // ré-encode en base64 pour les passer à Resend sur chaque envoi.
    const attachments: Array<{ filename: string; content: string; contentType?: string }> = [];
    for (const a of campaign.attachments ?? []) {
      try {
        const buf = await downloadPublicObject(a.path);
        attachments.push({
          filename: a.filename,
          content: buf.toString("base64"),
          contentType: a.contentType,
        });
      } catch (err) {
        req.log.error({ err, path: a.path }, "attachment download failed");
        throw new Error(`Impossible de charger la pièce jointe « ${a.filename} ».`);
      }
    }

    let sent = 0;
    let failed = 0;
    // Envoi séquentiel pour ne pas saturer Resend (rate limit ~10 req/s).
    // Pour gros volumes ce serait à passer en queue background.
    for (const contact of recipients) {
      try {
        const result = await sendEmail({
          to: [contact.email],
          subject: campaign.subject,
          body: campaign.bodyText,
          html: campaign.bodyHtml,
          ...(attachments.length > 0 ? { attachments } : {}),
          userId, // per-user : clé Resend perso ou quota freemium
          tags: [
            { name: "campaign_id", value: String(id) },
            { name: "user_id", value: userId.slice(0, 60) },
          ],
        });
        if (result.success) {
          sent++;
          await db
            .insert(emailEvents)
            .values({
              campaignId: id,
              contactEmail: contact.email,
              type: "sent",
              resendMessageId: result.messageId ?? null,
              payload: { provider: result.provider },
            })
            .onConflictDoNothing({
              target: [emailEvents.resendMessageId, emailEvents.type],
            });
        } else {
          failed++;
          await db.insert(emailEvents).values({
            campaignId: id,
            contactEmail: contact.email,
            type: "failed",
            payload: { error: result.error ?? "unknown", provider: result.provider },
          });
        }
      } catch (perRecipientErr) {
        // Une erreur inattendue sur un contact ne doit pas planter toute la boucle.
        failed++;
        req.log.error({ err: perRecipientErr, contact: contact.email }, "send to contact failed");
        await db.insert(emailEvents).values({
          campaignId: id,
          contactEmail: contact.email,
          type: "failed",
          payload: { error: String(perRecipientErr) },
        });
      }
    }

    const finalStatus: EmailCampaignStatus =
      failed === 0 ? "sent" : sent === 0 ? "failed" : "partially_failed";
    const [updated] = await db
      .update(emailCampaigns)
      .set({
        status: finalStatus,
        sentCount: (campaign.sentCount ?? 0) + sent,
        failedCount: (campaign.failedCount ?? 0) + failed,
        sentAt: new Date(),
        errorMessage: failed > 0 ? `${failed} envoi(s) ont échoué.` : null,
      })
      .where(eq(emailCampaigns.id, id))
      .returning();

    res.json({ campaign: updated, sent, failed, total: recipients.length });
  } catch (err) {
    // Tout échec mid-loop : on remet la campagne dans un statut terminal
    // déterministe pour qu'elle ne reste pas coincée en `sending`.
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "send campaign failed");
    await db
      .update(emailCampaigns)
      .set({
        status: "failed" as EmailCampaignStatus,
        errorMessage: msg.slice(0, 500),
      })
      .where(eq(emailCampaigns.id, id));
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
