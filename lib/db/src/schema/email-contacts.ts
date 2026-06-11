import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Contacts emails persistants par utilisateur.
// Chaque (userId, email) doit être unique pour éviter les doublons d'envoi.
export const emailContacts = pgTable(
  "email_contacts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    // Tags libres pour segmenter (ex. "client", "prospect", "newsletter")
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    // Champs personnalisés libres (ex. { "departement": "75", "entreprise": "Acme" }).
    // Utilisés comme merge tags dans les campagnes : {{DEPARTEMENT}}, {{ENTREPRISE}}, etc.
    customFields: jsonb("custom_fields").$type<Record<string, string>>().notNull().default({}),
    // Dossier (optionnel) pour organiser les contacts par groupe/enseigne.
    folderId: integer("folder_id"),
    // Désinscription : si false, on n'envoie plus jamais à cet email.
    subscribed: boolean("subscribed").notNull().default(true),
    // D'où vient le contact (import-csv, manuel, etc.)
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_contacts_user_id_idx").on(t.userId),
    index("email_contacts_folder_id_idx").on(t.folderId),
    uniqueIndex("email_contacts_user_email_unique").on(t.userId, t.email),
  ],
);

export const insertEmailContactSchema = createInsertSchema(emailContacts, {
  email: z.string().email("Adresse email invalide"),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  customFields: z.record(z.string().max(50).regex(/^[a-zA-Z_À-ɏ][a-zA-Z0-9_ À-ɏ]*$/), z.string().max(200)).optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  subscribed: true,
});

export type EmailContact = typeof emailContacts.$inferSelect;
export type InsertEmailContact = z.infer<typeof insertEmailContactSchema>;
