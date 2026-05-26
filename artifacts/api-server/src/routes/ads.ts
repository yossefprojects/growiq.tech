/**
 * Paid ads routes — Meta Ads + Google Ads.
 *
 * These endpoints are scaffolded ahead of provider validation. They all
 * degrade gracefully (HTTP 503 with a clear French message) when the
 * corresponding secrets aren't set yet, so the rest of the app keeps working.
 */
import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, adCampaigns, scheduledPosts } from "@workspace/db";
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
  setGoogleCampaignStatus,
  getGoogleCampaignMetrics,
} from "../lib/google-ads";

function uid(req: Request): string {
  return (req as AuthedRequest).userId;
}

const router: IRouter = Router();

// ── Status ──────────────────────────────────────────────────────────────────
router.get("/ads/status", (_req, res) => {
  res.json({
    meta: isMetaAdsConfigured(),
    google: isGoogleAdsConfigured(),
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

  const check = isGoogleAdsConfigured();
  if (!check.configured) {
    res.status(503).json({
      error: "Google Ads pas encore activé sur cette installation.",
      missing: check.missing,
      hint:
        "Attends l'approbation du developer token Google (2-6 semaines), puis ajoute les 6 secrets GOOGLE_ADS_*.",
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
      userId: uid(req),
      meta: {
        agencyCampaignId: body.agencyCampaignId,
        notificationEmail: body.notificationEmail,
        campaignName: body.campaignName,
      },
    })
    .returning();

  const result = await launchGoogleSearchCampaign({
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
  const r = await setGoogleCampaignStatus(record.providerCampaignId, status);
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
  const metrics =
    record.provider === "meta"
      ? await getMetaCampaignInsights(record.providerCampaignId)
      : await getGoogleCampaignMetrics(record.providerCampaignId);
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
