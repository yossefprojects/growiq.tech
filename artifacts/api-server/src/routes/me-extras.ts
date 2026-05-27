/**
 * /api/me/stats — counters for the current user (used by the account page).
 * /api/me/data — delete all user-owned data (irreversible).
 */
import { Router, type IRouter } from "express";
import { and, eq, sql, inArray } from "drizzle-orm";
import {
  db,
  scheduledPosts,
  agencyCampaigns,
  campaigns,
  landingPages,
  leads,
  conversations,
  messages,
  businessProfiles,
  adCampaigns,
  seoAudits,
  seoKeywordSets,
  seoContentPlans,
} from "@workspace/db";
import type { AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

function uid(req: unknown): string {
  return (req as AuthedRequest).userId;
}

router.get("/me/stats", async (req, res) => {
  const userId = uid(req);
  const c = sql<number>`count(*)::int`;
  const num = (rows: { count: number }[]) => Number(rows[0]?.count ?? 0);
  const [
    postsTotalRows,
    postsSentRows,
    agencyRows,
    lpRows,
    leadRows,
    convRows,
    msgRows,
    adsRows,
    seoAuditsRows,
    seoKwRows,
    seoPlansRows,
  ] = await Promise.all([
    db.select({ count: c }).from(scheduledPosts).where(eq(scheduledPosts.userId, userId)),
    db.select({ count: c }).from(scheduledPosts).where(and(eq(scheduledPosts.userId, userId), eq(scheduledPosts.status, "sent"))),
    db.select({ count: c }).from(agencyCampaigns).where(eq(agencyCampaigns.userId, userId)),
    db.select({ count: c }).from(landingPages).where(eq(landingPages.userId, userId)),
    db.select({ count: c }).from(leads).where(eq(leads.userId, userId)),
    db.select({ count: c }).from(conversations).where(eq(conversations.userId, userId)),
    db.select({ count: c }).from(messages).where(eq(messages.userId, userId)),
    db.select({ count: c }).from(adCampaigns).where(eq(adCampaigns.userId, userId)),
    db.select({ count: c }).from(seoAudits).where(eq(seoAudits.userId, userId)),
    db.select({ count: c }).from(seoKeywordSets).where(eq(seoKeywordSets.userId, userId)),
    db.select({ count: c }).from(seoContentPlans).where(eq(seoContentPlans.userId, userId)),
  ]);
  const postsTotal = num(postsTotalRows);
  const postsSent = num(postsSentRows);
  const agency = num(agencyRows);
  const lpCount = num(lpRows);
  const leadCount = num(leadRows);
  const convCount = num(convRows);
  const msgCount = num(msgRows);
  const adsCount = num(adsRows);
  const seoAuditsCount = num(seoAuditsRows);
  const seoKwCount = num(seoKwRows);
  const seoPlansCount = num(seoPlansRows);
  res.json({
    postsTotal,
    postsSent,
    agencyCampaigns: agency,
    landingPages: lpCount,
    leads: leadCount,
    conversations: convCount,
    messages: msgCount,
    adCampaigns: adsCount,
    seoAudits: seoAuditsCount,
    seoKeywordSets: seoKwCount,
    seoContentPlans: seoPlansCount,
  });
});

router.delete("/me/data", async (req, res) => {
  const userId = uid(req);
  // Wrap in a transaction so the irreversible action is atomic.
  await db.transaction(async (tx) => {
    const ownLandingIds = (
      await tx
        .select({ id: landingPages.id })
        .from(landingPages)
        .where(eq(landingPages.userId, userId))
    ).map((r) => r.id);
    if (ownLandingIds.length > 0) {
      await tx.delete(leads).where(inArray(leads.landingPageId, ownLandingIds));
    }
    await tx.delete(leads).where(eq(leads.userId, userId));
    await tx.delete(scheduledPosts).where(eq(scheduledPosts.userId, userId));
    await tx.delete(landingPages).where(eq(landingPages.userId, userId));
    await tx.delete(agencyCampaigns).where(eq(agencyCampaigns.userId, userId));
    await tx.delete(campaigns).where(eq(campaigns.userId, userId));
    await tx.delete(adCampaigns).where(eq(adCampaigns.userId, userId));
    await tx.delete(seoAudits).where(eq(seoAudits.userId, userId));
    await tx.delete(seoKeywordSets).where(eq(seoKeywordSets.userId, userId));
    await tx.delete(seoContentPlans).where(eq(seoContentPlans.userId, userId));
    await tx.delete(messages).where(eq(messages.userId, userId));
    await tx.delete(conversations).where(eq(conversations.userId, userId));
    await tx.delete(businessProfiles).where(eq(businessProfiles.userId, userId));
  });
  res.json({ ok: true });
});

export default router;
