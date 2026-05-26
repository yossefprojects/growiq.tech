/**
 * SEO routes — audit URL, keyword research, copywriting, content plan, report.
 *
 * Tradeoff notes (intentional, surfaced in product copy):
 *   - Keyword "volume" + "difficulty" are LLM-estimated (no Ahrefs/Semrush API).
 *     Labelled clearly in the UI as estimations.
 *   - URL audit uses a regex parser (no headless browser) — fast & cheap; will
 *     not "see" JS-rendered content. For most marketing sites this is fine.
 *   - All writes scoped by userId; reads filter by userId.
 */
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  seoAudits,
  seoKeywordSets,
  seoContentPlans,
  type SeoAuditReport,
  type SeoKeywordSet,
  type SeoContentPlan,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { AuthedRequest } from "../middlewares/auth";
import { safeFetchHtml, parseHtml, type ParsedHtml } from "../lib/seo-fetch";

function uid(req: Request): string {
  return (req as AuthedRequest).userId;
}

const router: IRouter = Router();

// ── helpers ────────────────────────────────────────────────────────────────

function scoreFromParsed(parsed: ParsedHtml): number {
  let s = 100;
  // Title
  const tlen = parsed.title?.length ?? 0;
  if (!parsed.title) s -= 20;
  else if (tlen < 30 || tlen > 65) s -= 8;
  // Meta description
  const mlen = parsed.metaDescription?.length ?? 0;
  if (!parsed.metaDescription) s -= 15;
  else if (mlen < 70 || mlen > 165) s -= 6;
  // H1
  if (parsed.h1.length === 0) s -= 15;
  else if (parsed.h1.length > 1) s -= 5;
  // H2 — bonus if >= 2
  if (parsed.h2.length < 2) s -= 5;
  // Word count
  if (parsed.wordCount < 200) s -= 15;
  else if (parsed.wordCount < 500) s -= 5;
  // Images
  if (parsed.imagesTotal > 0 && parsed.imagesMissingAlt > 0) {
    const ratio = parsed.imagesMissingAlt / parsed.imagesTotal;
    s -= Math.min(15, Math.round(ratio * 15));
  }
  // Language tag
  if (!parsed.language) s -= 3;
  return Math.max(0, Math.min(100, s));
}

// ── AUDIT ──────────────────────────────────────────────────────────────────

router.post("/seo/audit", async (req, res): Promise<void> => {
  const { url } = (req.body ?? {}) as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "URL manquante" });
    return;
  }

  const fetched = await safeFetchHtml(url.trim());
  if (!fetched.ok) {
    res.status(400).json({ error: fetched.error });
    return;
  }
  const parsed = parseHtml(fetched.page.html);
  const score = scoreFromParsed(parsed);

  // Ask LLM for recommendations + summary
  let recommendations: SeoAuditReport["recommendations"] = [];
  let summary = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un consultant SEO francophone qui parle à un utilisateur NON technique. " +
            "Donne des recommandations concrètes et expliquées en mots simples. Pas de jargon. " +
            "Réponds en JSON strict de la forme " +
            `{"summary":"phrase de synthèse en français","recommendations":[{"priority":"high|medium|low","title":"...","detail":"..."}]}`,
        },
        {
          role: "user",
          content: `URL analysée : ${fetched.page.finalUrl}\n\nDonnées extraites :\n${JSON.stringify(
            {
              title: parsed.title,
              titleLength: parsed.title?.length ?? 0,
              metaDescription: parsed.metaDescription,
              metaDescriptionLength: parsed.metaDescription?.length ?? 0,
              h1Count: parsed.h1.length,
              h1: parsed.h1,
              h2Count: parsed.h2.length,
              h2Samples: parsed.h2.slice(0, 5),
              wordCount: parsed.wordCount,
              imagesTotal: parsed.imagesTotal,
              imagesMissingAlt: parsed.imagesMissingAlt,
              language: parsed.language,
              score,
            },
            null,
            2,
          )}\n\nDonne 4 à 7 recommandations triées par priorité, et une synthèse en 1 phrase.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsedJson = JSON.parse(raw) as {
      summary?: string;
      recommendations?: SeoAuditReport["recommendations"];
    };
    summary = typeof parsedJson.summary === "string" ? parsedJson.summary : "";
    recommendations = Array.isArray(parsedJson.recommendations)
      ? parsedJson.recommendations
          .filter((r) => r && typeof r.title === "string")
          .map((r) => ({
            priority: (["high", "medium", "low"].includes(r.priority) ? r.priority : "medium") as
              | "high"
              | "medium"
              | "low",
            title: String(r.title).slice(0, 200),
            detail: String(r.detail ?? "").slice(0, 600),
          }))
          .slice(0, 10)
      : [];
  } catch (err) {
    req.log.warn({ err }, "SEO audit LLM call failed");
    summary = "Analyse terminée (recommandations IA indisponibles).";
  }

  const report: SeoAuditReport = {
    title: {
      value: parsed.title,
      length: parsed.title?.length ?? 0,
      ok: !!parsed.title && parsed.title.length >= 30 && parsed.title.length <= 65,
    },
    metaDescription: {
      value: parsed.metaDescription,
      length: parsed.metaDescription?.length ?? 0,
      ok:
        !!parsed.metaDescription &&
        parsed.metaDescription.length >= 70 &&
        parsed.metaDescription.length <= 165,
    },
    h1: { count: parsed.h1.length, samples: parsed.h1, ok: parsed.h1.length === 1 },
    h2: { count: parsed.h2.length, samples: parsed.h2 },
    wordCount: parsed.wordCount,
    images: { total: parsed.imagesTotal, missingAlt: parsed.imagesMissingAlt },
    language: parsed.language,
    recommendations,
    summary,
  };

  const [row] = await db
    .insert(seoAudits)
    .values({ userId: uid(req), url: fetched.page.finalUrl, score, report })
    .returning();
  res.status(201).json(row);
});

router.get("/seo/audits", async (req, res) => {
  const rows = await db
    .select()
    .from(seoAudits)
    .where(eq(seoAudits.userId, uid(req)))
    .orderBy(desc(seoAudits.createdAt))
    .limit(50);
  res.json(rows);
});

router.delete("/seo/audits/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  await db
    .delete(seoAudits)
    .where(and(eq(seoAudits.id, id), eq(seoAudits.userId, uid(req))));
  res.status(204).end();
});

// ── KEYWORDS ───────────────────────────────────────────────────────────────

router.post("/seo/keywords", async (req, res): Promise<void> => {
  const { topic, audience, goal } = (req.body ?? {}) as {
    topic?: string;
    audience?: string;
    goal?: string;
  };
  if (!topic || typeof topic !== "string") {
    res.status(400).json({ error: "Décris ton sujet ou ton activité." });
    return;
  }

  let data: SeoKeywordSet;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert SEO francophone. Propose 15 à 20 mots-clés pertinents pour le sujet donné. " +
            "Inclut un MÉLANGE de longue traîne (3-5 mots) et de mots-clés courts. " +
            "Pour chaque mot-clé, estime difficulté (facile/moyenne/difficile), volume (faible/moyen/élevé) et intention. " +
            "IMPORTANT : volume et difficulté sont des estimations IA, à ne pas confondre avec des données Ahrefs/Semrush. " +
            "Réponds en JSON strict : " +
            `{"summary":"phrase en français","keywords":[{"keyword":"...","intent":"informationnel|commercial|transactionnel|navigationnel","difficulty":"facile|moyenne|difficile","estimatedVolume":"faible|moyen|élevé","rationale":"pourquoi ce mot-clé"}]}`,
        },
        {
          role: "user",
          content: `Sujet/activité : ${topic.slice(0, 500)}\n${audience ? `Cible : ${audience.slice(0, 300)}\n` : ""}${goal ? `Objectif : ${goal.slice(0, 200)}\n` : ""}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<SeoKeywordSet>;
    data = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords
            .filter((k) => k && typeof k.keyword === "string")
            .map((k) => ({
              keyword: String(k.keyword).slice(0, 120),
              intent: (["informationnel", "commercial", "transactionnel", "navigationnel"].includes(
                k.intent,
              )
                ? k.intent
                : "informationnel") as SeoKeywordSet["keywords"][number]["intent"],
              difficulty: (["facile", "moyenne", "difficile"].includes(k.difficulty)
                ? k.difficulty
                : "moyenne") as SeoKeywordSet["keywords"][number]["difficulty"],
              estimatedVolume: (["faible", "moyen", "élevé"].includes(k.estimatedVolume)
                ? k.estimatedVolume
                : "moyen") as SeoKeywordSet["keywords"][number]["estimatedVolume"],
              rationale: String(k.rationale ?? "").slice(0, 300),
            }))
            .slice(0, 25)
        : [],
    };
  } catch (err) {
    req.log.error({ err }, "Keyword generation failed");
    res.status(500).json({ error: "Échec de la génération. Réessaye." });
    return;
  }

  const [row] = await db
    .insert(seoKeywordSets)
    .values({
      userId: uid(req),
      topic: topic.slice(0, 500),
      audience: audience?.slice(0, 300) ?? null,
      goal: goal?.slice(0, 200) ?? null,
      data,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/seo/keywords", async (req, res) => {
  const rows = await db
    .select()
    .from(seoKeywordSets)
    .where(eq(seoKeywordSets.userId, uid(req)))
    .orderBy(desc(seoKeywordSets.createdAt))
    .limit(50);
  res.json(rows);
});

router.delete("/seo/keywords/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  await db
    .delete(seoKeywordSets)
    .where(and(eq(seoKeywordSets.id, id), eq(seoKeywordSets.userId, uid(req))));
  res.status(204).end();
});

// ── COPYWRITING ────────────────────────────────────────────────────────────

const COPY_TYPES = ["article", "meta-description", "title", "alt"] as const;
type CopyType = (typeof COPY_TYPES)[number];

router.post("/seo/copy", async (req, res): Promise<void> => {
  const { type, keyword, brief } = (req.body ?? {}) as {
    type?: CopyType;
    keyword?: string;
    brief?: string;
  };
  if (!type || !COPY_TYPES.includes(type)) {
    res.status(400).json({ error: "type doit être article, meta-description, title ou alt" });
    return;
  }
  if (!keyword || typeof keyword !== "string") {
    res.status(400).json({ error: "Mot-clé cible requis" });
    return;
  }

  const instructions: Record<CopyType, string> = {
    article:
      "Rédige un article de blog SEO de 600 à 900 mots en français, avec : un H1 contenant le mot-clé, " +
      "3 à 5 sous-titres H2, une introduction qui hook le lecteur, et une conclusion avec call-to-action. " +
      "Style accessible, ton expert mais chaleureux. Pas de bourrage de mots-clés. " +
      "Réponds en JSON : {\"title\":\"...\",\"metaDescription\":\"...\",\"body\":\"... (markdown)\"}",
    "meta-description":
      "Rédige 3 propositions de méta-descriptions de 140 à 160 caractères incluant le mot-clé, " +
      "engageantes, en français. Réponds en JSON : {\"variants\":[\"...\",\"...\",\"...\"]}",
    title:
      "Propose 5 titres SEO de 50 à 60 caractères incluant le mot-clé, accrocheurs, en français. " +
      "Réponds en JSON : {\"variants\":[\"...\",\"...\",\"...\",\"...\",\"...\"]}",
    alt:
      "Pour une image illustrant ce sujet, propose 5 textes alternatifs (alt) de 80 caractères max " +
      "incluant naturellement le mot-clé, en français. " +
      "Réponds en JSON : {\"variants\":[\"...\",\"...\",\"...\",\"...\",\"...\"]}",
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: type === "article" ? 2500 : 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Tu es un rédacteur SEO francophone expert. " + instructions[type] },
        {
          role: "user",
          content: `Mot-clé cible : ${keyword.slice(0, 120)}\n${brief ? `Contexte : ${brief.slice(0, 600)}` : ""}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    res.json({ type, keyword, result: JSON.parse(raw) });
  } catch (err) {
    req.log.error({ err }, "SEO copy generation failed");
    res.status(500).json({ error: "Échec de la rédaction. Réessaye." });
  }
});

// ── CONTENT PLAN ───────────────────────────────────────────────────────────

router.post("/seo/plan", async (req, res): Promise<void> => {
  const { title, horizonDays, keywords, context } = (req.body ?? {}) as {
    title?: string;
    horizonDays?: 30 | 60 | 90;
    keywords?: string[];
    context?: string;
  };
  const horizon: 30 | 60 | 90 =
    horizonDays === 60 ? 60 : horizonDays === 90 ? 90 : 30;
  const safeKeywords = Array.isArray(keywords)
    ? keywords.filter((k): k is string => typeof k === "string").slice(0, 30)
    : [];
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "Donne un titre à ton plan" });
    return;
  }
  if (safeKeywords.length === 0) {
    res.status(400).json({ error: "Sélectionne au moins un mot-clé" });
    return;
  }

  let plan: SeoContentPlan;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un consultant en stratégie éditoriale. Génère un calendrier éditorial SEO concret sur " +
            `${horizon} jours, basé sur les mots-clés fournis. ` +
            "Mélange articles de blog, posts sociaux, newsletter. Cadence raisonnable (2-4 contenus/semaine max). " +
            "Réponds en JSON strict : " +
            `{"summary":"synthèse","horizonDays":${horizon},"items":[{"week":1,"day":1,"type":"article|post-social|newsletter|video","title":"...","targetKeyword":"...","angle":"...","expectedImpact":"fort|moyen|faible"}]}`,
        },
        {
          role: "user",
          content: `Mots-clés cibles : ${safeKeywords.join(", ")}\n${context ? `Contexte : ${context.slice(0, 500)}` : ""}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<SeoContentPlan>;
    plan = {
      horizonDays: horizon,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      items: Array.isArray(parsed.items)
        ? parsed.items
            .filter((i) => i && typeof i.title === "string")
            .map((i) => ({
              week: Math.max(1, Math.min(13, Number(i.week) || 1)),
              day: Math.max(1, Math.min(7, Number(i.day) || 1)),
              type: (["article", "post-social", "newsletter", "video"].includes(i.type)
                ? i.type
                : "article") as SeoContentPlan["items"][number]["type"],
              title: String(i.title).slice(0, 200),
              targetKeyword: String(i.targetKeyword ?? "").slice(0, 120),
              angle: String(i.angle ?? "").slice(0, 300),
              expectedImpact: (["fort", "moyen", "faible"].includes(i.expectedImpact)
                ? i.expectedImpact
                : "moyen") as SeoContentPlan["items"][number]["expectedImpact"],
            }))
            .slice(0, 60)
        : [],
    };
  } catch (err) {
    req.log.error({ err }, "Content plan generation failed");
    res.status(500).json({ error: "Échec de la génération du plan. Réessaye." });
    return;
  }

  const [row] = await db
    .insert(seoContentPlans)
    .values({
      userId: uid(req),
      title: title.slice(0, 200),
      horizonDays: horizon,
      plan,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/seo/plans", async (req, res) => {
  const rows = await db
    .select()
    .from(seoContentPlans)
    .where(eq(seoContentPlans.userId, uid(req)))
    .orderBy(desc(seoContentPlans.createdAt))
    .limit(20);
  res.json(rows);
});

router.delete("/seo/plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  await db
    .delete(seoContentPlans)
    .where(and(eq(seoContentPlans.id, id), eq(seoContentPlans.userId, uid(req))));
  res.status(204).end();
});

// ── REPORT ─────────────────────────────────────────────────────────────────

router.get("/seo/report", async (req, res) => {
  const userId = uid(req);
  const [audits, keywords, plans] = await Promise.all([
    db.select().from(seoAudits).where(eq(seoAudits.userId, userId)).orderBy(desc(seoAudits.createdAt)),
    db.select().from(seoKeywordSets).where(eq(seoKeywordSets.userId, userId)).orderBy(desc(seoKeywordSets.createdAt)),
    db.select().from(seoContentPlans).where(eq(seoContentPlans.userId, userId)).orderBy(desc(seoContentPlans.createdAt)),
  ]);
  const latestAudit = audits[0] ?? null;
  const oldestAudit = audits[audits.length - 1] ?? null;
  const scoreEvolution =
    latestAudit && oldestAudit && latestAudit.id !== oldestAudit.id
      ? latestAudit.score - oldestAudit.score
      : 0;
  const totalKeywords = keywords.reduce((acc, k) => acc + (k.data?.keywords?.length ?? 0), 0);
  const totalPlannedContents = plans.reduce((acc, p) => acc + (p.plan?.items?.length ?? 0), 0);

  const nextActions: { title: string; reason: string }[] = [];
  if (audits.length === 0) {
    nextActions.push({
      title: "Lance ton premier audit SEO",
      reason: "Une analyse de ton site te donnera une note de départ et les points à corriger.",
    });
  } else if (latestAudit && latestAudit.score < 80) {
    const topReco = latestAudit.report.recommendations.find((r) => r.priority === "high");
    if (topReco) nextActions.push({ title: topReco.title, reason: topReco.detail });
  }
  if (keywords.length === 0) {
    nextActions.push({
      title: "Génère ta liste de mots-clés",
      reason: "Sans mots-clés cibles, impossible de prioriser les contenus à créer.",
    });
  }
  if (keywords.length > 0 && plans.length === 0) {
    nextActions.push({
      title: "Crée un plan éditorial 30 jours",
      reason: "Transforme tes mots-clés en calendrier d'articles pour les prochaines semaines.",
    });
  }

  res.json({
    counters: {
      audits: audits.length,
      keywordSets: keywords.length,
      keywords: totalKeywords,
      contentPlans: plans.length,
      plannedContents: totalPlannedContents,
    },
    latestAudit: latestAudit
      ? { id: latestAudit.id, url: latestAudit.url, score: latestAudit.score, createdAt: latestAudit.createdAt }
      : null,
    scoreEvolution,
    nextActions,
  });
});

export default router;
