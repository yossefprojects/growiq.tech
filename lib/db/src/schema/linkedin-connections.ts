import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const linkedinConnections = pgTable(
  "linkedin_connections",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    personUrn: text("person_urn").notNull(),
    name: text("name"),
    email: text("email"),
    pictureUrl: text("picture_url"),
    scopes: text("scopes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("linkedin_connections_user_id_unique").on(t.userId),
    index("linkedin_connections_user_id_idx").on(t.userId),
  ],
);

export type LinkedinConnection = typeof linkedinConnections.$inferSelect;
