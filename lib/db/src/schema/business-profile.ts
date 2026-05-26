import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessProfiles = pgTable(
  "business_profiles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    businessName: text("business_name"),
    activity: text("activity"),
    targetAudience: text("target_audience"),
    tone: text("tone"),
    primaryGoal: text("primary_goal"),
    onboardingCompleted: text("onboarding_completed").notNull().default("false"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("business_profiles_user_id_unique").on(t.userId),
    index("business_profiles_user_id_idx").on(t.userId),
  ],
);

export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
