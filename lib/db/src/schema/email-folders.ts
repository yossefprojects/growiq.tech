import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Dossiers pour ranger les contacts par liste (ex. "PDV Intermarché").
// Un contact appartient à au plus un dossier (folderId nullable côté contacts).
export const emailFolders = pgTable(
  "email_folders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_folders_user_id_idx").on(t.userId),
    uniqueIndex("email_folders_user_name_unique").on(t.userId, t.name),
  ],
);

export const insertEmailFolderSchema = createInsertSchema(emailFolders, {
  name: z.string().trim().min(1, "Le nom du dossier est requis").max(120),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type EmailFolder = typeof emailFolders.$inferSelect;
export type InsertEmailFolder = z.infer<typeof insertEmailFolderSchema>;
