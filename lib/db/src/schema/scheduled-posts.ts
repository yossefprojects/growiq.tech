import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export type ScheduledPostMeta = {
  recipients?: string[];
  subject?: string;
  notes?: string;
  imageUrl?: string;
  metaPostId?: string;
  metaPermalink?: string;
  notificationEmail?: string;
  campaignName?: string;
  campaignId?: number;
  originalScheduledFor?: string;
};

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    platform: text("platform").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    meta: jsonb("meta").$type<ScheduledPostMeta>().notNull().default({} as ScheduledPostMeta),
    conversationId: integer("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("scheduled_posts_user_id_idx").on(t.userId)],
);

export const insertScheduledPostSchema = createInsertSchema(scheduledPosts).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  errorMessage: true,
  userId: true,
});

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
