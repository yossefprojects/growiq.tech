/**
 * Paid ads routes — Meta Ads + Google Ads.
 *
 * These endpoints are scaffolded ahead of provider validation. They all
 * degrade gracefully (HTTP 503 with a clear French message) when the
 * corresponding secrets aren't set yet, so the rest of the app keeps working.
 */
import { Router, type IRouter, type Request } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, adCampaigns, scheduledPosts, seoKeywordSets, businessProfiles } from "@workspace/db";
import type { AuthedRequest } from "../middlewares/auth";
import {
  isMetaAdsConfigured,
  boostFacebookPost,
  setMetaCampaignStatus,
  getMetaCampaignInsights,
} from "../lib/meta-ads";
import {
  isGoogleAdsConfigured,
  launchGoogleSearchCampaign,
  launchGoogleSearchCampaignForUser,
  setGoogleCampaignStatus,
  setGoogleCampaignStatusForUser,
  getGoogleCampaignMetrics,
  getGoogleCampaignMetricsForUser,
  getUserGoogleAdsCreds,
  type UserGoogleAdsCreds,
} from "../lib/google-ads";
import { openai } from "@workspace/integrations-openai-ai-server";

function uid(req: Request): string {
  return (req as AuthedRequest).userId;
}

const router: IRouter = Router();

// SECURITY: Meta Ads uses GLOBAL admin env credentials — gate to admins.
// Google Ads now uses per-user credentials (OAuth) — open to all authenticated users.
router.use((req, res, next) => {
  if (!req.path.startsWith("/ads")) {
    next();
    return;
  }
  // Google Ads routes are open to all authenticated users (they use their own OAuth creds)
  if (req.path.startsWith("/ads/google") || req.path === "/ads/status" || req.path === "/ads") {
    next();
    return;
  }
  // Meta Ads routes: admin-only
  const isAdmin = (req as unknown as { isAdmin?: boolean }).isAdmin === true;
  if (isAdmin) {
    next();
    return;
  }
  if (req.method === "GET") {
    res.json([]);
    return;
  }
  res.status(403).json({
    error: "Les campagnes Meta Ads ne sont pas disponibles sur ton compte.",
    code: "ads_admin_only",
  });
});

// ── Status ──────────────────────────────────────────────────────────────────
router.get("/ads/status", async (req, res) => {
  const userId = uid(req);
  const userCreds = await getUserGoogleAdsCreds(userId);
  res.json({
    meta: isMetaAdsConfigured(),
    google: userCreds
      ? { configured: true, missing: [], userConnected: true }
      : isGoogleAdsConfigured(),
  });
});

// ── Meta Ads: boost an existing organic post ────────────────────────────────
router.post("/ads/meta/boost", async (req, res): Promise<void> => {
  const { scheduledPostId, dailyBudgetCents, durationDays, targeting } = req.body as {
    scheduledPostId?: number;
    dailyBudgetCents?: number;
    durationDays?: number;
    targeting?: Parameters<typeof boostFacebookPost>[0]["targeting"];
  };

  if (!scheduledPostId || !dailyBudgetCents || !durationDays) {
    res.status(400).json({ error: "scheduledPostId, dailyBudgetCents et durationDays requis" });
    return;
  }

  const check = isMetaAdsConfigured();
  if (!check.configured) {
    res.status(503).json({
      error: "Meta Ads pas encore activé sur cette installation.",
      missing: check.missing,
      hint: "Termine l'App Review Facebook puis ajoute les secrets manquants.",
    });
    return;
  }

  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(and(eq(scheduledPosts.id, scheduledPostId), eq(scheduledPosts.userId, uid(req))));
  if (!post) {
    res.status(404).json({ error: "Post programmé introuvable" });
    return;
  }
  if (post.platform !== "facebook") {
    res.status(400).json({ error: "Seuls les posts Facebook peuvent être boostés via cette route" });
    return;
  }
  const fbPostId = post.meta?.metaPostId;
  if (!fbPostId) {
    res.status(400).json({
      error: "Ce post n'a pas encore été publié — attends que le scheduler le publie avant de le booster.",
    });
    return;
  }

  // Record the intent in DB first so we always have an audit trail, even if the
  // provider call fails or partially succeeds.
  const [record] = await db
    .insert(adCampaigns)
    .values({
      provider: "meta",
      status: "draft",
      budgetCents: dailyBudgetCents * durationDays,
      durationDays,
      userId: uid(req),
      meta: {
        scheduledPostId: post.id,
        agencyCampaignId: post.meta?.campaignId,
        notificationEmail: post.meta?.notificationEmail,
        campaignName: post.meta?.campaignName ?? `Boost ${post.title}`,
      },
    })
    .returning();

  const campaignName = `${post.meta?.campaignName ?? "GrowIQ"} — boost #${record.id}`;
  const result = await boostFacebookPost({
    fbPostId,
    dailyBudgetCents,
    durationDays,
    campaignName,
    targeting,
  });

  if (!result.success) {
    await db
      .update(adCampaigns)
      .set({ status: "failed", errorMessage: result.error.slice(0, 500) })
      .where(eq(adCampaigns.id, record.id));
    res.status(502).json({ error: result.error, configMissing: result.configMissing });
    return;
  }

  await db
    .update(adCampaigns)
    .set({
      providerCampaignId: result.campaignId,
      status: "paused", // we created it PAUSED — operator must activate explicitly
    })
    .where(eq(adCampaigns.id, record.id));

  res.json({
    id: record.id,
    campaignId: result.campaignId,
    status: "paused",
    message:
      "Campagne créée et mise en pause. Vérifie-la dans Ads Manager puis active-la via POST /api/ads/meta/:id/activate.",
  });
});

// ── Meta Ads: activate / pause ──────────────────────────────────────────────
router.post("/ads/meta/:id/activate", async (req, res): Promise<void> => {
  await toggleMetaStatus(Number(req.params.id), "ACTIVE", uid(req), res);
});

router.post("/ads/meta/:id/pause", async (req, res): Promise<void> => {
  await toggleMetaStatus(Number(req.params.id), "PAUSED", uid(req), res);
});

async function toggleMetaStatus(
  id: number,
  status: "ACTIVE" | "PAUSED",
  userId: string,
  res: import("express").Response,
): Promise<void> {
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  const [record] = await db
    .select()
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, userId)));
  if (!record || !record.providerCampaignId) {
    res.status(404).json({ error: "Campagne introuvable ou pas encore créée chez Meta" });
    return;
  }
  const r = await setMetaCampaignStatus(record.providerCampaignId, status);
  if (!r.ok) {
    res.status(502).json({ error: r.error });
    return;
  }
  await db
    .update(adCampaigns)
    .set({
      status: status === "ACTIVE" ? "active" : "paused",
      startedAt: status === "ACTIVE" && !record.startedAt ? new Date() : record.startedAt,
      pausedAt: status === "PAUSED" ? new Date() : null,
    })
    .where(eq(adCampaigns.id, id));
  res.json({ id, status: status.toLowerCase() });
}

// ── Google Ads: launch a Search campaign ────────────────────────────────────
router.post("/ads/google/launch", async (req, res): Promise<void> => {
  const body = req.body as {
    campaignName?: string;
    dailyBudgetCents?: number;
    durationDays?: number;
    finalUrl?: string;
    headlines?: string[];
    descriptions?: string[];
    keywords?: string[];
    agencyCampaignId?: number;
    notificationEmail?: string;
  };

  if (
    !body.campaignName ||
    !body.dailyBudgetCents ||
    !body.durationDays ||
    !body.finalUrl ||
    !body.headlines?.length ||
    !body.descriptions?.length ||
    !body.keywords?.length
  ) {
    res.status(400).json({
      error:
        "Champs requis : campaignName, dailyBudgetCents, durationDays, finalUrl, headlines[], descriptions[], keywords[]",
    });
    return;
  }

  const userId = uid(req);
  const userCreds = await getUserGoogleAdsCreds(userId);
  if (!userCreds) {
    res.status(503).json({
      error: "Connecte d'abord ton compte Google Ads via Paramètres > Intégrations.",
      code: "google_ads_not_connected",
    });
    return;
  }

  const [record] = await db
    .insert(adCampaigns)
    .values({
      provider: "google",
      status: "draft",
      budgetCents: body.dailyBudgetCents * body.durationDays,
      durationDays: body.durationDays,
      userId,
      meta: {
        agencyCampaignId: body.agencyCampaignId,
        notificationEmail: body.notificationEmail,
        campaignName: body.campaignName,
      },
    })
    .returning();

  const result = await launchGoogleSearchCampaignForUser(userCreds, {
    campaignName: body.campaignName,
    dailyBudgetCents: body.dailyBudgetCents,
    finalUrl: body.finalUrl,
    headlines: body.headlines,
    descriptions: body.descriptions,
    keywords: body.keywords,
  });

  if (!result.success) {
    await db
      .update(adCampaigns)
      .set({ status: "failed", errorMessage: result.error.slice(0, 500) })
      .where(eq(adCampaigns.id, record.id));
    res.status(502).json({ error: result.error, configMissing: result.configMissing });
    return;
  }

  await db
    .update(adCampaigns)
    .set({ providerCampaignId: result.campaignResource, status: "paused" })
    .where(eq(adCampaigns.id, record.id));

  res.json({
    id: record.id,
    campaignResource: result.campaignResource,
    status: "paused",
    message:
      "Campagne créée et mise en pause. Vérifie-la dans Google Ads puis active-la via POST /api/ads/google/:id/activate.",
  });
});

// ── Google Ads: AI-powered launch (SEO → headlines/descriptions/keywords) ──
router.post("/ads/google/ai-launch", async (req, res): Promise<void> => {
  const body = req.body as {
    objective?: string;
    dailyBudgetCents?: number;
    durationDays?: number;
    finalUrl?: string;
    campaignName?: string;
    audience?: string;
  };

  if (!body.dailyBudgetCents || !body.durationDays || !body.finalUrl) {
    res.status(400).json({
      error: "Champs requis : dailyBudgetCents, durationDays, finalUrl",
    });
    return;
  }

  const userId = uid(req);
  const userCreds = await getUserGoogleAdsCreds(userId);
  if (!userCreds) {
    res.status(503).json({
      error: "Connecte d'abord ton compte Google Ads via Paramètres > Intégrations.",
      code: "google_ads_not_connected",
    });
    return;
  }

  // 1. Fetch SEO keywords for this user
  const seoSets = await db
    .select()
    .from(seoKeywordSets)
    .where(eq(seoKeywordSets.userId, userId))
    .orderBy(desc(seoKeywordSets.createdAt))
    .limit(3);

  const allSeoKeywords = seoSets.flatMap((s) => s.data?.keywords ?? []);
  const commercialKeywords = allSeoKeywords
    .filter((k) => k.intent === "transactionnel" || k.intent === "commercial")
    .map((k) => k.keyword);
  const allKeywordTexts = allSeoKeywords.map((k) => k.keyword);
  const adsKeywords = commercialKeywords.length >= 5
    ? commercialKeywords.slice(0, 20)
    : allKeywordTexts.slice(0, 20);

  // 2. Fetch business profile
  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, userId))
    .limit(1);

  const businessContext = [
    profile?.businessName && `Entreprise : ${profile.businessName}`,
    profile?.activity && `Secteur : ${profile.activity}`,
    profile?.targetAudience && `Cible : ${profile.targetAudience}`,
    body.audience && `Audience spécifiée : ${body.audience}`,
    body.objective && `Objectif : ${body.objective}`,
  ].filter(Boolean).join("\n");

  // 3. Use AI to generate headlines + descriptions from SEO data
  const keywordList = adsKeywords.length > 0
    ? adsKeywords.join(", ")
    : "marketing digital, croissance entreprise, acquisition clients";

  const aiPrompt = `Tu es un expert Google Ads. Génère des éléments pour une campagne Search basée sur ces données.

${businessContext}
URL de destination : ${body.finalUrl}
Mots-clés SEO disponibles : ${keywordList}

Réponds UNIQUEMENT en JSON valide (pas de markdown) :
{
  "campaignName": "nom court et percutant pour la campagne (max 60 chars)",
  "headlines": ["titre1", "titre2", ...],
  "descriptions": ["description1", "description2", ...],
  "keywords": ["mot-clé1", "mot-clé2", ...]
}

RÈGLES :
- headlines : exactement 10 titres, chacun ≤ 30 caractères, percutants et variés
- descriptions : exactement 4 descriptions, chacune ≤ 90 caractères, avec appel à l'action
- keywords : 15-20 mots-clés pertinents pour Google Search, mélange de génériques et longue traîne
- Intègre naturellement les mots-clés SEO fournis
- Langue : français`;

  let generated: { campaignName: string; headlines: string[]; descriptions: string[]; keywords: string[] };
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1200,
      messages: [{ role: "user", content: aiPrompt }],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    generated = JSON.parse(match ? match[0] : raw);
  } catch (err) {
    res.status(500).json({ error: "Erreur IA lors de la génération des annonces." });
    return;
  }

  if (!generated.headlines?.length || generated.headlines.length < 3) {
    res.status(500).json({ error: "L'IA n'a pas pu générer assez de titres." });
    return;
  }

  const campaignName = body.campaignName || generated.campaignName || `GrowIQ — ${new Date().toLocaleDateString("fr")}`;
  const finalKeywords = generated.keywords?.length > 0 ? generated.keywords : adsKeywords;

  // 4. Create DB record
  const [record] = await db
    .insert(adCampaigns)
    .values({
      provider: "google",
      status: "draft",
      budgetCents: body.dailyBudgetCents * body.durationDays,
      durationDays: body.durationDays,
      userId,
      meta: {
        campaignName,
        notes: `AI-generated from SEO. Objective: ${body.objective ?? "non spécifié"}. Keywords source: ${adsKeywords.length} SEO keywords.`,
      },
    })
    .returning();

  // 5. Launch on Google Ads (PAUSED) — per-user credentials
  const result = await launchGoogleSearchCampaignForUser(userCreds, {
    campaignName,
    dailyBudgetCents: body.dailyBudgetCents,
    finalUrl: body.finalUrl,
    headlines: generated.headlines.map((h: string) => h.slice(0, 30)),
    descriptions: generated.descriptions.map((d: string) => d.slice(0, 90)),
    keywords: finalKeywords.slice(0, 20),
  });

  if (!result.success) {
    await db
      .update(adCampaigns)
      .set({ status: "failed", errorMessage: result.error.slice(0, 500) })
      .where(eq(adCampaigns.id, record.id));
    res.status(502).json({ error: result.error, configMissing: result.configMissing });
    return;
  }

  await db
    .update(adCampaigns)
    .set({ providerCampaignId: result.campaignResource, status: "paused" })
    .where(eq(adCampaigns.id, record.id));

  res.json({
    id: record.id,
    campaignResource: result.campaignResource,
    status: "paused",
    campaignName,
    generated: {
      headlines: generated.headlines,
      descriptions: generated.descriptions,
      keywords: finalKeywords.slice(0, 20),
      seoKeywordsUsed: adsKeywords.length,
    },
    message: "Campagne Google Ads créée en pause. L'utilisateur peut l'activer quand il est prêt.",
  });
});

// ── Google Ads: activate / pause ────────────────────────────────────────────
router.post("/ads/google/:id/activate", async (req, res): Promise<void> => {
  await toggleGoogleStatus(Number(req.params.id), "ENABLED", uid(req), res);
});

router.post("/ads/google/:id/pause", async (req, res): Promise<void> => {
  await toggleGoogleStatus(Number(req.params.id), "PAUSED", uid(req), res);
});

async function toggleGoogleStatus(
  id: number,
  status: "ENABLED" | "PAUSED",
  userId: string,
  res: import("express").Response,
): Promise<void> {
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  const [record] = await db
    .select()
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, userId)));
  if (!record || !record.providerCampaignId) {
    res.status(404).json({ error: "Campagne introuvable ou pas encore créée chez Google" });
    return;
  }
  const userCreds = await getUserGoogleAdsCreds(userId);
  const r = userCreds
    ? await setGoogleCampaignStatusForUser(userCreds, record.providerCampaignId, status)
    : await setGoogleCampaignStatus(record.providerCampaignId, status);
  if (!r.ok) {
    res.status(502).json({ error: r.error });
    return;
  }
  await db
    .update(adCampaigns)
    .set({
      status: status === "ENABLED" ? "active" : "paused",
      startedAt: status === "ENABLED" && !record.startedAt ? new Date() : record.startedAt,
      pausedAt: status === "PAUSED" ? new Date() : null,
    })
    .where(eq(adCampaigns.id, id));
  res.json({ id, status: status === "ENABLED" ? "active" : "paused" });
}

// ── Listing + metrics ───────────────────────────────────────────────────────
router.get("/ads", async (req, res) => {
  const rows = await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.userId, uid(req)));
  res.json(rows);
});

router.get("/ads/:id/metrics", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  const [record] = await db
    .select()
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, uid(req))));
  if (!record || !record.providerCampaignId) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  let metrics;
  if (record.provider === "meta") {
    metrics = await getMetaCampaignInsights(record.providerCampaignId);
  } else {
    const userCreds = await getUserGoogleAdsCreds(uid(req));
    metrics = userCreds
      ? await getGoogleCampaignMetricsForUser(userCreds, record.providerCampaignId)
      : await getGoogleCampaignMetrics(record.providerCampaignId);
  }
  if (!metrics.ok) {
    res.status(502).json({ error: metrics.error });
    return;
  }
  await db
    .update(adCampaigns)
    .set({
      lastMetrics: {
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        spendCents: metrics.spendCents,
        fetchedAt: new Date().toISOString(),
      },
    })
    .where(eq(adCampaigns.id, id));
  res.json(metrics);
});

export default router;
