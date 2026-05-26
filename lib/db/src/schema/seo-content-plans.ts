import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type SeoContentPlanItem = {
  week: number;
  day: number;
  type: "article" | "post-social" | "newsletter" | "video";
  title: string;
  targetKeyword: string;
  angle: string;
  expectedImpact: "fort" | "moyen" | "faible";
};

export type SeoContentPlan = {
  horizonDays: 30 | 60 | 90;
  items: SeoContentPlanItem[];
  summary: string;
};

export const seoContentPlans = pgTable(
  "seo_content_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    title: text("title").notNull(),
    horizonDays: integer("horizon_days").notNull().default(30),
    plan: jsonb("plan").$type<SeoContentPlan>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("seo_content_plans_user_id_idx").on(t.userId)],
);

export type SeoContentPlanRow = typeof seoContentPlans.$inferSelect;
