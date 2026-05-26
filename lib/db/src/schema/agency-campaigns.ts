import { index, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type AgencyBrief = {
  product: string;
  audience: string;
  budget: string;
  objective: string;
  channels: string[];
};

export type AgencyDecision = {
  what: string;
  why: string;
};

export type AgencyPlannedPost = {
  id: string;
  channel: "facebook" | "instagram";
  scheduledFor: string;
  copy: string;
  imagePrompt: string;
  imageUrl?: string;
  scheduledPostId?: number;
};

export type AgencyPlan = {
  audienceSummary: string;
  targetingNarrative: string;
  budgetNarrative: string;
  estimatedResults: {
    impressions: string;
    clicks: string;
    conversions: string;
  };
  posts: AgencyPlannedPost[];
  recommendations: string[];
  decisions?: AgencyDecision[];
};

export const agencyCampaigns = pgTable(
  "agency_campaigns",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    brief: jsonb("brief").$type<AgencyBrief>().notNull(),
    plan: jsonb("plan").$type<AgencyPlan>().notNull(),
    notificationEmail: text("notification_email"),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("agency_campaigns_user_id_idx").on(t.userId)],
);

export type AgencyCampaign = typeof agencyCampaigns.$inferSelect;
