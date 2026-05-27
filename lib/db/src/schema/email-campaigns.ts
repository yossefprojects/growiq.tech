import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Brief utilisé par l'IA pour générer le contenu de l'email.
export type EmailCampaignBrief = {
  product: string;
  audience: string;
  objective: string;
  subject?: string;
  tone?: string;
};

export type EmailCampaignStatus =
  | "draft"
  | "sending"
  | "sent"
  | "partially_failed"
  | "failed";

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // Sujet de l'email tel qu'il arrive dans la boîte du destinataire.
    subject: text("subject").notNull(),
    // Deux versions du corps : HTML rendu + plain text fallback.
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull().default(""),
    status: text("status").$type<EmailCampaignStatus>().notNull().default("draft"),
    brief: jsonb("brief").$type<EmailCampaignBrief>().notNull(),
    // Compteurs maintenus à jour à l'envoi + par le webhook Resend.
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),
    // Envoi différé non encore wiré côté worker — champ présent pour plus tard.
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("email_campaigns_user_id_idx").on(t.userId)],
);

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns, {
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
}).omit({
  id: true,
  userId: true,
  status: true,
  recipientCount: true,
  sentCount: true,
  failedCount: true,
  openCount: true,
  clickCount: true,
  sentAt: true,
  errorMessage: true,
  createdAt: true,
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
