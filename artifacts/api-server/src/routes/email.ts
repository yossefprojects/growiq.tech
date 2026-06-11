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
import crypto from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  emailContacts,
  emailContactFolders,
  emailCampaigns,
  emailEvents,
  insertEmailContactSchema,
  type EmailCampaignBrief,
  type EmailCampaignStatus,
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

// Remplace les merge tags {{NOM_DU_CHAMP}} par les valeurs du contact.
// Champs spéciaux : PRENOM, NOM, EMAIL. Le reste vient de customFields.
function replaceMergeTags(
  text: string,
  contact: { email: string; firstName: string; lastName: string; customFields?: Record<string, string> },
): string {
  const map: Record<string, string> = {
    PRENOM: contact.firstName,
    NOM: contact.lastName,
    EMAIL: contact.email,
    ...Object.fromEntries(
      Object.entries(contact.customFields ?? {}).map(([k, v]) => [k.toUpperCase(), v]),
    ),
  };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => map[key.toUpperCase()] ?? match);
}

const router: IRouter = Router();
export const publicEmailRouter: IRouter = Router();

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
        customFields: parsed.data.customFields ?? {},
        folderId: parsed.data.folderId ?? null,
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
        customFields: z.record(z.string().max(200)).optional(),
      }),
    )
    .min(1)
    .max(5000),
  folderId: z.number().int().positive().optional(),
});

router.post("/email/contacts/bulk", async (req, res) => {
  const userId = uid(req);
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  // Vérifier que le dossier appartient bien à l'utilisateur
  if (parsed.data.folderId) {
    const [folder] = await db
      .select({ id: emailContactFolders.id })
      .from(emailContactFolders)
      .where(and(eq(emailContactFolders.userId, userId), eq(emailContactFolders.id, parsed.data.folderId)));
    if (!folder) {
      res.status(404).json({ error: "Dossier introuvable" });
      return;
    }
  }
  const values = parsed.data.contacts.map((c) => ({
    userId,
    email: c.email.toLowerCase().trim(),
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    tags: c.tags ?? [],
    customFields: c.customFields ?? {},
    folderId: parsed.data.folderId ?? null,
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

// Déplacer des contacts vers un dossier (en masse)
router.post("/email/contacts/move-to-folder", async (req, res) => {
  const userId = uid(req);
  const schema = z.object({
    contactIds: z.array(z.number().int()).optional(),
    fromFolderId: z.number().int().nullable().optional(), // null = sans dossier, undefined = ignorer
    allInFolder: z.boolean().optional(), // true = déplacer tous les contacts du fromFolderId
    toFolderId: z.number().int().nullable(), // null = retirer du dossier
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  // Vérifier que le dossier cible existe (si non null)
  if (parsed.data.toFolderId !== null) {
    const [folder] = await db
      .select({ id: emailContactFolders.id })
      .from(emailContactFolders)
      .where(and(eq(emailContactFolders.userId, userId), eq(emailContactFolders.id, parsed.data.toFolderId!)));
    if (!folder) {
      res.status(404).json({ error: "Dossier cible introuvable" });
      return;
    }
  }

  const conds = [eq(emailContacts.userId, userId)];

  if (parsed.data.contactIds && parsed.data.contactIds.length > 0) {
    // Déplacer des contacts spécifiques par ID
    const ids = parsed.data.contactIds;
    const updated = await db
      .update(emailContacts)
      .set({ folderId: parsed.data.toFolderId })
      .where(and(...conds, sql`${emailContacts.id} = ANY(${ids})`))
      .returning({ id: emailContacts.id });
    res.json({ moved: updated.length });
  } else if (parsed.data.allInFolder !== undefined) {
    // Déplacer TOUS les contacts d'un dossier (ou sans dossier)
    if (parsed.data.fromFolderId === null) {
      conds.push(sql`${emailContacts.folderId} IS NULL`);
    } else if (parsed.data.fromFolderId !== undefined) {
      conds.push(eq(emailContacts.folderId, parsed.data.fromFolderId!));
    }
    const updated = await db
      .update(emailContacts)
      .set({ folderId: parsed.data.toFolderId })
      .where(and(...conds))
      .returning({ id: emailContacts.id });
    res.json({ moved: updated.length });
  } else {
    res.status(400).json({ error: "Spécifie contactIds ou allInFolder" });
  }
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

// Suppression en masse de contacts
router.post("/email/contacts/bulk-delete", async (req, res) => {
  const userId = uid(req);
  const parsed = z.object({ ids: z.array(z.number().int()).min(1).max(5000) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Liste d'IDs invalide" });
    return;
  }
  const { ids } = parsed.data;
  let deleted = 0;
  for (const id of ids) {
    const [row] = await db
      .delete(emailContacts)
      .where(and(eq(emailContacts.userId, userId), eq(emailContacts.id, id)))
      .returning({ id: emailContacts.id });
    if (row) deleted++;
  }
  res.json({ deleted });
});

// ── Dossiers de contacts ──────────────────────────────────────────────────

router.get("/email/folders", async (req, res) => {
  const userId = uid(req);
  const rows = await db
    .select()
    .from(emailContactFolders)
    .where(eq(emailContactFolders.userId, userId))
    .orderBy(emailContactFolders.name);
  // Compter le nombre de contacts par dossier
  const counts = await db
    .select({
      folderId: emailContacts.folderId,
      count: sql<number>`count(*)::int`,
    })
    .from(emailContacts)
    .where(and(eq(emailContacts.userId, userId), sql`${emailContacts.folderId} IS NOT NULL`))
    .groupBy(emailContacts.folderId);
  const countMap = new Map(counts.map((c) => [c.folderId, c.count]));
  res.json(rows.map((f) => ({ ...f, contactCount: countMap.get(f.id) ?? 0 })));
});

router.post("/email/folders", async (req, res) => {
  const userId = uid(req);
  const schema = z.object({
    name: z.string().min(1).max(120),
    color: z.string().max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Nom de dossier invalide" });
    return;
  }
  try {
    const [row] = await db
      .insert(emailContactFolders)
      .values({ userId, name: parsed.data.name.trim(), color: parsed.data.color ?? "#8b5cf6" })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("email_contact_folders_user_name_unique")) {
      res.status(409).json({ error: "Un dossier avec ce nom existe déjà." });
      return;
    }
    res.status(500).json({ error: "Impossible de créer le dossier." });
  }
});

router.put("/email/folders/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const schema = z.object({
    name: z.string().min(1).max(120).optional(),
    color: z.string().max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const [updated] = await db
    .update(emailContactFolders)
    .set(parsed.data)
    .where(and(eq(emailContactFolders.userId, userId), eq(emailContactFolders.id, id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Dossier introuvable" }); return; }
  res.json(updated);
});

router.delete("/email/folders/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  // Dissocier les contacts du dossier avant suppression
  await db
    .update(emailContacts)
    .set({ folderId: null })
    .where(and(eq(emailContacts.userId, userId), eq(emailContacts.folderId, id)));
  await db
    .delete(emailContactFolders)
    .where(and(eq(emailContactFolders.userId, userId), eq(emailContactFolders.id, id)));
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

interface GeneratedEmail {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

async function generateEmailWithAI(brief: EmailCampaignBrief, style: "vouvoiement" | "tutoiement" = "vouvoiement"): Promise<GeneratedEmail> {
  const styleInstruction = style === "vouvoiement"
    ? "VOUVOIEMENT OBLIGATOIRE : utilise « vous », « votre », « vos » partout. Ne tutoie JAMAIS."
    : "TUTOIEMENT : utilise « tu », « ton », « tes » partout. Ne vouvoie pas.";

  const prompt = `Tu es un expert en email marketing francophone.
Rédige UN email pour cette campagne. Réponds STRICTEMENT en JSON :
{"subject": "...", "bodyText": "...", "bodyHtml": "..."}

Règles :
- Sujet court (max 60 caractères), accrocheur, sans clickbait.
- bodyText : version texte plain, lisible, sans markdown.
- bodyHtml : HTML simple et propre (<p>, <h2>, <a>, <strong>). Pas de CSS inline complexe.
- ${styleInstruction}
- Ton : ${brief.tone || "professionnel, naturel"}.
- Termine par une signature simple [Signature] et un PS si pertinent.

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
  const style = parsed.data.style ?? "vouvoiement";
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
  // On ne peut modifier que les brouillons
  const [row] = await db
    .update(emailCampaigns)
    .set(parsed.data)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id), eq(emailCampaigns.status, "draft")))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Campagne introuvable ou déjà envoyée (seuls les brouillons peuvent être modifiés)." });
    return;
  }
  res.json(row);
});

// ── Dupliquer une campagne en nouveau brouillon ────────────────────────────
router.post("/email/campaigns/:id/duplicate", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const [original] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  if (!original) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  const [copy] = await db
    .insert(emailCampaigns)
    .values({
      userId,
      name: `${original.name} (copie)`,
      brief: original.brief,
      subject: original.subject,
      bodyHtml: original.bodyHtml,
      bodyText: original.bodyText,
      status: "draft",
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      openCount: 0,
      clickCount: 0,
      attachments: original.attachments,
    })
    .returning();
  res.json(copy);
});

// ── Remettre une campagne échouée en brouillon ─────────────────────────────
router.post("/email/campaigns/:id/reset", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const [row] = await db
    .update(emailCampaigns)
    .set({
      status: "draft" as EmailCampaignStatus,
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      openCount: 0,
      clickCount: 0,
      errorMessage: null,
      sentAt: null,
    })
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id), eq(emailCampaigns.status, "failed")))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Campagne introuvable ou pas en état 'échoué'." });
    return;
  }
  // Nettoyer les events précédents
  await db.delete(emailEvents).where(eq(emailEvents.campaignId, id));
  res.json(row);
});

router.delete("/email/campaigns/:id", async (req, res) => {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  // Empêcher la suppression des campagnes déjà envoyées (pour conserver l'historique et les stats)
  const [existing] = await db
    .select({ status: emailCampaigns.status })
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  if (!existing) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  if (existing.status === "sent" || existing.status === "sending" || existing.status === "partially_failed") {
    res.status(403).json({
      error: "Impossible de supprimer une campagne déjà envoyée. L'historique et les statistiques sont conservés.",
    });
    return;
  }
  await db
    .delete(emailCampaigns)
    .where(and(eq(emailCampaigns.userId, userId), eq(emailCampaigns.id, id)));
  res.json({ ok: true });
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
  // Soit on cible des contacts spécifiques par ID, soit "tous", soit par tag, soit par dossier.
  contactIds: z.array(z.number().int()).optional(),
  tag: z.string().optional(),
  folderId: z.number().int().positive().optional(),
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
    } else if (parsed.data.folderId) {
      recipients = recipients.filter((c) => c.folderId === parsed.data.folderId);
    } else if (parsed.data.tag) {
      const tag = parsed.data.tag;
      recipients = recipients.filter((c) => c.tags.includes(tag));
    } else if (!parsed.data.allSubscribed) {
      // Aucun filtre + pas de allSubscribed → on refuse pour éviter d'envoyer
      // accidentellement à TOUTE la base.
      throw new Error(
        "Sélectionne des contacts, un tag, un dossier, ou coche \"tous les abonnés\".",
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
    // Envoi séquentiel + throttle pour respecter la limite Resend (2 req/s par
    // défaut). On espace chaque envoi d'au moins 550 ms (~1.8 req/s) ; en cas de
    // 429 ponctuel, sendEmail réessaie de son côté avec l'en-tête Retry-After.
    // Tradeoff : pour de grosses listes l'envoi peut prendre 1-2 min ; un vrai
    // worker en file d'attente serait nécessaire au-delà de quelques centaines.
    const SEND_SPACING_MS = 550;
    let first = true;
    for (const contact of recipients) {
      if (!first) await new Promise((r) => setTimeout(r, SEND_SPACING_MS));
      first = false;
      try {
        const personalSubject = replaceMergeTags(campaign.subject, contact);
        const personalText = replaceMergeTags(campaign.bodyText, contact);
        const unsubUrl = buildUnsubscribeUrl(contact.email, userId);
        let personalHtml = campaign.bodyHtml ? replaceMergeTags(campaign.bodyHtml, contact) : undefined;
        if (personalHtml) personalHtml = appendUnsubscribeFooter(personalHtml, unsubUrl);
        const result = await sendEmail({
          to: [contact.email],
          subject: personalSubject,
          body: personalText + `\n\n---\nSe désinscrire : ${unsubUrl}`,
          html: personalHtml,
          unsubscribeUrl: unsubUrl,
          ...(attachments.length > 0 ? { attachments } : {}),
          userId,
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

// ── Unsubscribe (public, no auth) ───────────────────────────────────────

function unsubSecret(): string {
  return process.env["SESSION_SECRET"] || "growiq-unsub-fallback";
}

function signUnsubscribe(email: string, userId: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, u: userId })).toString("base64url");
  const sig = crypto.createHmac("sha256", unsubSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyUnsubscribe(token: string): { email: string; userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", unsubSecret()).update(payload!).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")) as { e: string; u: string };
    return { email: data.e, userId: data.u };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(email: string, userId: string, baseUrl?: string): string {
  const token = signUnsubscribe(email, userId);
  const base = baseUrl || process.env["PUBLIC_URL"] || "https://growiq.tech";
  return `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function appendUnsubscribeFooter(html: string, unsubUrl: string): string {
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
<p>Vous recevez cet email car vous êtes dans notre liste de contacts.</p>
<p><a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">Se désinscrire</a></p>
</div>`;
  if (html.includes("</body>")) return html.replace("</body>", `${footer}</body>`);
  return html + footer;
}

// Public route — no auth required (link clicked from email)
publicEmailRouter.get("/email/unsubscribe", async (req, res) => {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : "";
  const verified = verifyUnsubscribe(token);
  if (!verified) {
    res.status(400).send(unsubPage("Lien invalide ou expiré.", false));
    return;
  }
  const updated = await db
    .update(emailContacts)
    .set({ subscribed: false })
    .where(
      and(
        eq(emailContacts.userId, verified.userId),
        eq(emailContacts.email, verified.email.toLowerCase()),
      ),
    )
    .returning({ id: emailContacts.id });
  if (updated.length > 0) {
    res.send(unsubPage("Vous avez été désinscrit(e) avec succès. Vous ne recevrez plus d'emails de notre part.", true));
  } else {
    res.send(unsubPage("Cette adresse n'est pas dans notre liste ou est déjà désinscrite.", true));
  }
});

function unsubPage(message: string, success: boolean): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désinscription</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
.card{max-width:420px;padding:2rem;text-align:center;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(0,0,0,.1);}
.icon{font-size:3rem;margin-bottom:1rem;}
p{color:#374151;line-height:1.6;}</style></head>
<body><div class="card"><div class="icon">${success ? "✅" : "⚠️"}</div><p>${message}</p></div></body></html>`;
}

export default router;
