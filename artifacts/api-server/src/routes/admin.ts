/**
 * Admin CRM routes — list all signed-up users and inspect each user's projects.
 *
 * Gated by requireAuth + requireAdmin upstream in routes/index.ts.
 * Read-only; no mutations exposed here.
 */
import { Router, type IRouter, type Request } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  localUsers,
  businessProfiles,
  conversations,
  messages,
  agencyCampaigns,
  scheduledPosts,
  landingPages,
  leads,
  adCampaigns,
  seoAudits,
  seoKeywordSets,
  seoContentPlans,
} from "@workspace/db";

const router: IRouter = Router();

type CountRow = { userId: string | null; count: number };

// ── helpers ────────────────────────────────────────────────────────────────

async function aggregateCounts(): Promise<{
  conversations: Map<string, number>;
  messages: Map<string, number>;
  agency: Map<string, number>;
  scheduledPosts: Map<string, number>;
  landingPages: Map<string, number>;
  leads: Map<string, number>;
  adCampaigns: Map<string, number>;
  seoAudits: Map<string, number>;
  seoKeywords: Map<string, number>;
  seoPlans: Map<string, number>;
  businessProfileSet: Set<string>;
  orphanRows: number;
  orphanProfiles: number;
}> {
  const toMap = (rows: { userId: string | null; count: number }[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.userId) m.set(r.userId, Number(r.count) || 0);
    return m;
  };
  const orphans = { value: 0 };
  const addOrphans = (rows: { userId: string | null; count: number }[]) => {
    for (const r of rows) if (!r.userId) orphans.value += Number(r.count) || 0;
  };
  const [
    conv,
    msg,
    agency,
    sched,
    lp,
    ld,
    ads,
    audits,
    kws,
    plans,
    profiles,
  ] = await Promise.all([
    db.select({ userId: conversations.userId, count: sql<number>`count(*)::int` })
      .from(conversations).groupBy(conversations.userId),
    db.select({ userId: messages.userId, count: sql<number>`count(*)::int` })
      .from(messages).groupBy(messages.userId),
    db.select({ userId: agencyCampaigns.userId, count: sql<number>`count(*)::int` })
      .from(agencyCampaigns).groupBy(agencyCampaigns.userId),
    db.select({ userId: scheduledPosts.userId, count: sql<number>`count(*)::int` })
      .from(scheduledPosts).groupBy(scheduledPosts.userId),
    db.select({ userId: landingPages.userId, count: sql<number>`count(*)::int` })
      .from(landingPages).groupBy(landingPages.userId),
    db.select({ userId: leads.userId, count: sql<number>`count(*)::int` })
      .from(leads).groupBy(leads.userId),
    db.select({ userId: adCampaigns.userId, count: sql<number>`count(*)::int` })
      .from(adCampaigns).groupBy(adCampaigns.userId),
    db.select({ userId: seoAudits.userId, count: sql<number>`count(*)::int` })
      .from(seoAudits).groupBy(seoAudits.userId),
    db.select({ userId: seoKeywordSets.userId, count: sql<number>`count(*)::int` })
      .from(seoKeywordSets).groupBy(seoKeywordSets.userId),
    db.select({ userId: seoContentPlans.userId, count: sql<number>`count(*)::int` })
      .from(seoContentPlans).groupBy(seoContentPlans.userId),
    db.select({ userId: businessProfiles.userId }).from(businessProfiles),
  ]);
  const profileSet = new Set<string>();
  let orphanProfiles = 0;
  for (const p of profiles) {
    if (p.userId) profileSet.add(p.userId);
    else orphanProfiles++;
  }
  for (const rows of [conv, msg, agency, sched, lp, ld, ads, audits, kws, plans]) {
    addOrphans(rows as CountRow[]);
  }
  return {
    orphanRows: orphans.value,
    orphanProfiles,
    conversations: toMap(conv as CountRow[]),
    messages: toMap(msg as CountRow[]),
    agency: toMap(agency as CountRow[]),
    scheduledPosts: toMap(sched as CountRow[]),
    landingPages: toMap(lp as CountRow[]),
    leads: toMap(ld as CountRow[]),
    adCampaigns: toMap(ads as CountRow[]),
    seoAudits: toMap(audits as CountRow[]),
    seoKeywords: toMap(kws as CountRow[]),
    seoPlans: toMap(plans as CountRow[]),
    businessProfileSet: profileSet,
  };
}

// ── routes ────────────────────────────────────────────────────────────────

router.get("/admin/users", async (_req, res) => {
  const allUsers = await db
    .select()
    .from(localUsers)
    .orderBy(desc(localUsers.lastSeenAt));
  const counts = await aggregateCounts();

  const rows = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    isAdmin: u.isAdmin,
    firstSeenAt: u.firstSeenAt,
    lastSeenAt: u.lastSeenAt,
    hasBusinessProfile: counts.businessProfileSet.has(u.id),
    counters: {
      conversations: counts.conversations.get(u.id) ?? 0,
      messages: counts.messages.get(u.id) ?? 0,
      agencyCampaigns: counts.agency.get(u.id) ?? 0,
      scheduledPosts: counts.scheduledPosts.get(u.id) ?? 0,
      landingPages: counts.landingPages.get(u.id) ?? 0,
      leads: counts.leads.get(u.id) ?? 0,
      adCampaigns: counts.adCampaigns.get(u.id) ?? 0,
      seoAudits: counts.seoAudits.get(u.id) ?? 0,
      seoKeywordSets: counts.seoKeywords.get(u.id) ?? 0,
      seoContentPlans: counts.seoPlans.get(u.id) ?? 0,
    },
  }));

  // Aggregate totals across all users
  const totals = rows.reduce(
    (acc, r) => {
      acc.users++;
      if (r.hasBusinessProfile) acc.profiles++;
      for (const k of Object.keys(r.counters) as (keyof typeof r.counters)[]) {
        acc[k] = (acc[k] ?? 0) + r.counters[k];
      }
      return acc;
    },
    { users: 0, profiles: 0 } as Record<string, number>,
  );
  totals.orphanRows = counts.orphanRows;
  totals.orphanProfiles = counts.orphanProfiles;

  res.json({ users: rows, totals });
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!id) {
    res.status(400).json({ error: "id manquant" });
    return;
  }
  const [user] = await db.select().from(localUsers).where(eq(localUsers.id, id));
  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  const [
    profile,
    convs,
    agency,
    sched,
    lps,
    leadRows,
    ads,
    audits,
    kws,
    plans,
  ] = await Promise.all([
    db.select().from(businessProfiles).where(eq(businessProfiles.userId, id)).limit(1),
    db.select().from(conversations).where(eq(conversations.userId, id)).orderBy(desc(conversations.createdAt)).limit(50),
    db.select().from(agencyCampaigns).where(eq(agencyCampaigns.userId, id)).orderBy(desc(agencyCampaigns.createdAt)).limit(50),
    db.select().from(scheduledPosts).where(eq(scheduledPosts.userId, id)).orderBy(desc(scheduledPosts.createdAt)).limit(50),
    db.select().from(landingPages).where(eq(landingPages.userId, id)).orderBy(desc(landingPages.createdAt)).limit(50),
    db.select().from(leads).where(eq(leads.userId, id)).orderBy(desc(leads.createdAt)).limit(100),
    db.select().from(adCampaigns).where(eq(adCampaigns.userId, id)).orderBy(desc(adCampaigns.createdAt)).limit(50),
    db.select().from(seoAudits).where(eq(seoAudits.userId, id)).orderBy(desc(seoAudits.createdAt)).limit(50),
    db.select().from(seoKeywordSets).where(eq(seoKeywordSets.userId, id)).orderBy(desc(seoKeywordSets.createdAt)).limit(50),
    db.select().from(seoContentPlans).where(eq(seoContentPlans.userId, id)).orderBy(desc(seoContentPlans.createdAt)).limit(50),
  ]);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      firstSeenAt: user.firstSeenAt,
      lastSeenAt: user.lastSeenAt,
    },
    businessProfile: profile[0] ?? null,
    conversations: convs.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt })),
    agencyCampaigns: agency.map((a) => ({
      id: a.id, name: a.name, status: a.status,
      brief: a.brief, postsCount: a.plan?.posts?.length ?? 0,
      launchedAt: a.launchedAt, createdAt: a.createdAt,
    })),
    scheduledPosts: sched.map((p) => ({
      id: p.id, title: p.title, platform: p.platform,
      status: p.status, scheduledFor: p.scheduledFor, sentAt: p.sentAt,
      errorMessage: p.errorMessage,
    })),
    landingPages: lps.map((l) => ({
      id: l.id, slug: l.slug, title: l.title, active: l.active, createdAt: l.createdAt,
    })),
    leads: leadRows.map((l) => ({
      id: l.id, email: l.email, name: l.name, landingPageId: l.landingPageId, createdAt: l.createdAt,
    })),
    adCampaigns: ads.map((a) => ({
      id: a.id, provider: a.provider, status: a.status,
      budgetCents: a.budgetCents, currency: a.currency, createdAt: a.createdAt,
    })),
    seoAudits: audits.map((a) => ({
      id: a.id, url: a.url, score: a.score, createdAt: a.createdAt,
    })),
    seoKeywordSets: kws.map((k) => ({
      id: k.id, topic: k.topic, keywordCount: k.data?.keywords?.length ?? 0, createdAt: k.createdAt,
    })),
    seoContentPlans: plans.map((p) => ({
      id: p.id, title: p.title, horizonDays: p.horizonDays,
      itemCount: p.plan?.items?.length ?? 0, createdAt: p.createdAt,
    })),
  });
});

export default router;
