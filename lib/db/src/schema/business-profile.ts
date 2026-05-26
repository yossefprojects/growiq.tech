import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessProfiles = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  businessName: text("business_name"),
  activity: text("activity"),
  targetAudience: text("target_audience"),
  tone: text("tone"),
  primaryGoal: text("primary_goal"),
  onboardingCompleted: text("onboarding_completed").notNull().default("false"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
