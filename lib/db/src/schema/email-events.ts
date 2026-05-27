import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { emailCampaigns } from "./email-campaigns";

// Types d'événements supportés (correspondent aux events Resend webhook).
export type EmailEventType =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

// Un événement par destinataire et par type. Permet de calculer les stats
// d'une campagne et d'auditer ce qui s'est passé pour chaque email.
export const emailEvents = pgTable(
  "email_events",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    contactEmail: text("contact_email").notNull(),
    type: text("type").$type<EmailEventType>().notNull(),
    // ID retourné par Resend à l'envoi — utilisé pour matcher les webhooks.
    resendMessageId: text("resend_message_id"),
    // Payload brut Resend (debug / URL cliquée / etc).
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_events_campaign_id_idx").on(t.campaignId),
    index("email_events_message_id_idx").on(t.resendMessageId),
    index("email_events_campaign_type_idx").on(t.campaignId, t.type),
    // Idempotency : Resend peut renvoyer le même event plusieurs fois (retry).
    // On garde un seul event par (message, type). Sur les inserts internes
    // sans messageId on tombe sur un autre row (NULL ne déclenche pas l'unique).
    uniqueIndex("email_events_message_type_unique_idx").on(t.resendMessageId, t.type),
  ],
);

export type EmailEvent = typeof emailEvents.$inferSelect;
