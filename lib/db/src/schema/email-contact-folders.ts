import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Dossiers pour organiser les contacts email.
 * Chaque dossier appartient à un utilisateur et a un nom unique (par user).
 * Ex : "Intermarché PDV", "Leclerc Drives", "Prospects Salon 2026"
 */
export const emailContactFolders = pgTable(
  "email_contact_folders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8b5cf6"), // violet par défaut
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_contact_folders_user_id_idx").on(t.userId),
    uniqueIndex("email_contact_folders_user_name_unique").on(t.userId, t.name),
  ],
);

export const insertEmailContactFolderSchema = createInsertSchema(emailContactFolders, {
  name: z.string().min(1, "Le nom du dossier est requis").max(120),
  color: z.string().max(20).optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type EmailContactFolder = typeof emailContactFolders.$inferSelect;
export type InsertEmailContactFolder = z.infer<typeof insertEmailContactFolderSchema>;
