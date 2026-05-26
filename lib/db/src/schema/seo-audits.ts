import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type SeoAuditReport = {
  title: { value: string | null; length: number; ok: boolean };
  metaDescription: { value: string | null; length: number; ok: boolean };
  h1: { count: number; samples: string[]; ok: boolean };
  h2: { count: number; samples: string[] };
  wordCount: number;
  images: { total: number; missingAlt: number };
  language: string | null;
  recommendations: { priority: "high" | "medium" | "low"; title: string; detail: string }[];
  summary: string;
};

export const seoAudits = pgTable(
  "seo_audits",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    url: text("url").notNull(),
    score: integer("score").notNull(),
    report: jsonb("report").$type<SeoAuditReport>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("seo_audits_user_id_idx").on(t.userId)],
);

export type SeoAudit = typeof seoAudits.$inferSelect;
