import { index, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type SeoKeyword = {
  keyword: string;
  intent: "informationnel" | "commercial" | "transactionnel" | "navigationnel";
  difficulty: "facile" | "moyenne" | "difficile";
  estimatedVolume: "faible" | "moyen" | "élevé";
  rationale: string;
};

export type SeoKeywordSet = {
  keywords: SeoKeyword[];
  summary: string;
};

export const seoKeywordSets = pgTable(
  "seo_keyword_sets",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    topic: text("topic").notNull(),
    audience: text("audience"),
    goal: text("goal"),
    data: jsonb("data").$type<SeoKeywordSet>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("seo_keyword_sets_user_id_idx").on(t.userId)],
);

export type SeoKeywordSetRow = typeof seoKeywordSets.$inferSelect;
