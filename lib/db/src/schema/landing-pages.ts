import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export type LandingPageStyle = {
  primaryColor?: string;
  bgColor?: string;
  heroImage?: string;
};

export const landingPages = pgTable(
  "landing_pages",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    headline: text("headline").notNull(),
    subheadline: text("subheadline").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default("Je m'inscris"),
    successMessage: text("success_message").notNull().default("Merci ! Nous vous recontactons très vite."),
    fields: jsonb("fields").$type<string[]>().notNull().default(["name", "email"]),
    style: jsonb("style").$type<LandingPageStyle>().notNull().default({} as LandingPageStyle),
    conversationId: integer("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("landing_pages_user_id_idx").on(t.userId)],
);

export const insertLandingPageSchema = createInsertSchema(landingPages).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;
