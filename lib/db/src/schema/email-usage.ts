import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Compteur d'emails envoyés via la clé admin partagée (mode freemium).
// Un row par (userId, année, mois). Incrémenté à chaque envoi sur la clé admin.
// Quand l'utilisateur connecte sa propre clé Resend, on ne compte plus.
// Reset implicite chaque 1er du mois (nouvelle ligne créée à la 1ère send).
export const emailUsage = pgTable(
  "email_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("email_usage_user_month_unique").on(t.userId, t.year, t.month),
    index("email_usage_user_id_idx").on(t.userId),
  ],
);

export type EmailUsage = typeof emailUsage.$inferSelect;

// Quota mensuel par utilisateur sur la clé admin partagée.
export const FREEMIUM_EMAIL_MONTHLY_QUOTA = 100;
