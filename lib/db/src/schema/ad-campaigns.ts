import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type AdCampaignMetrics = {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spendCents?: number;
  fetchedAt?: string;
};

export type AdCampaignMeta = {
  scheduledPostId?: number;
  agencyCampaignId?: number;
  notificationEmail?: string;
  campaignName?: string;
  notes?: string;
};

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    provider: text("provider").notNull(),
    providerCampaignId: text("provider_campaign_id"),
    status: text("status").notNull().default("draft"),
    budgetCents: integer("budget_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    durationDays: integer("duration_days").notNull().default(7),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    lastMetrics: jsonb("last_metrics").$type<AdCampaignMetrics>(),
    errorMessage: text("error_message"),
    meta: jsonb("meta").$type<AdCampaignMeta>().notNull().default({} as AdCampaignMeta),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ad_campaigns_user_id_idx").on(t.userId)],
);

export type AdCampaign = typeof adCampaigns.$inferSelect;
