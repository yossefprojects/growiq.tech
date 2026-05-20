import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { landingPages } from "./landing-pages";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  landingPageId: integer("landing_page_id")
    .notNull()
    .references(() => landingPages.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  source: text("source").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
