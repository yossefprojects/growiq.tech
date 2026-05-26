import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export type CampaignBusinessContext = {
  businessName: string;
  sector: string;
  audience: string;
  objective: string;
  tone: string;
  extra?: string;
};

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    title: text("title").notNull(),
    type: text("type").notNull(),
    businessContext: jsonb("business_context")
      .$type<CampaignBusinessContext>()
      .notNull()
      .default({} as CampaignBusinessContext),
    conversationId: integer("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaigns_user_id_idx").on(t.userId)],
);

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
