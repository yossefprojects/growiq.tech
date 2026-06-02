import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const localUsers = pgTable(
  "local_users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    isAdmin: boolean("is_admin").notNull().default(false),
    backfillClaimed: boolean("backfill_claimed").notNull().default(false),
    // Langue d'interface choisie par l'utilisateur ("fr" par défaut, "en" pour l'anglais).
    language: text("language").notNull().default("fr"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("local_users_email_idx").on(t.email)],
);

export type LocalUser = typeof localUsers.$inferSelect;
