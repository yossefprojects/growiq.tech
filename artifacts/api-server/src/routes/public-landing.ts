import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, landingPages, leads } from "@workspace/db";

const router: IRouter = Router();

const submitHits = new Map<string, number[]>();
const SUBMIT_WINDOW_MS = 60_000;
const SUBMIT_MAX = 5;
const ALLOWED_LEAD_FIELDS = new Set(["name", "email", "phone", "message", "company"]);

router.get("/public/landing/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug;
  const [page] = await db.select().from(landingPages).where(eq(landingPages.slug, slug));
  if (!page || !page.active) {
    res.status(404).json({ error: "Page introuvable" });
    return;
  }
  res.json({
    slug: page.slug,
    title: page.title,
    headline: page.headline,
    subheadline: page.subheadline,
    ctaLabel: page.ctaLabel,
    successMessage: page.successMessage,
    fields: page.fields,
    style: page.style,
  });
});

router.post("/public/landing/:slug/submit", async (req, res): Promise<void> => {
  const slug = req.params.slug;
  const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.ip || "anon");
  const key = `${ip}:${slug}`;
  const now = Date.now();
  const hits = (submitHits.get(key) ?? []).filter((t) => now - t < SUBMIT_WINDOW_MS);
  if (hits.length >= SUBMIT_MAX) {
    res.status(429).json({ error: "Trop de soumissions. Réessayez dans 1 minute." });
    return;
  }
  hits.push(now);
  submitHits.set(key, hits);

  const [page] = await db.select().from(landingPages).where(eq(landingPages.slug, slug));
  if (!page || !page.active) {
    res.status(404).json({ error: "Page introuvable" });
    return;
  }
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const k of Object.keys(raw)) {
    if (!ALLOWED_LEAD_FIELDS.has(k)) continue;
    const v = raw[k];
    if (typeof v !== "string") continue;
    data[k] = v.slice(0, 500).trim();
  }
  const email = (data.email ?? "").toLowerCase();
  const name = data.name ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    res.status(400).json({ error: "Email invalide" });
    return;
  }
  data.email = email;
  await db.insert(leads).values({
    landingPageId: page.id,
    userId: page.userId,
    email,
    name,
    data,
    source: (req.headers.referer ?? "").toString().slice(0, 500),
  });
  res.json({ success: true, message: page.successMessage });
});

export default router;
