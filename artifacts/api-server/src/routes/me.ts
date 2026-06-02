import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, localUsers } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const SUPPORTED_LANGUAGES = ["fr", "en"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

async function getUserLanguage(userId: string): Promise<SupportedLanguage> {
  const [row] = await db
    .select({ language: localUsers.language })
    .from(localUsers)
    .where(eq(localUsers.id, userId));
  const lang = row?.language;
  return lang === "en" ? "en" : "fr";
}

router.get("/me", requireAuth, async (req, res) => {
  const r = req as AuthedRequest;
  const language = await getUserLanguage(r.userId);
  res.json({
    userId: r.userId,
    email: r.userEmail,
    isAdmin: r.isAdmin,
    language,
  });
});

const updateLanguageSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
});

router.patch("/me/language", requireAuth, async (req, res) => {
  const r = req as AuthedRequest;
  const parsed = updateLanguageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Langue non supportée", code: "invalid_language" });
    return;
  }
  await db
    .update(localUsers)
    .set({ language: parsed.data.language })
    .where(eq(localUsers.id, r.userId));
  res.json({ language: parsed.data.language });
});

export default router;
