import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const systemEvents = pgTable("system_events", {
  eventKey: text("event_key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SystemEvent = typeof systemEvents.$inferSelect;
