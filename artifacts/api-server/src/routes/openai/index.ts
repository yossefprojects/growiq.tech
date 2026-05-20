import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
  CreateOpenaiConversationBody,
  GenerateOpenaiImageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MARKETING_SYSTEM_PROMPT = `Tu es un expert en marketing avec une connaissance approfondie de tous les domaines du marketing. Tu aides les professionnels et entrepreneurs à développer leurs stratégies marketing.

Tu couvres les domaines suivants :

**Marketing Digital & Inbound/Outbound**
- SEO (Search Engine Optimization), SEM, référencement payant
- Marketing de contenu, blogging, podcasting
- Réseaux sociaux (Instagram, TikTok, LinkedIn, Facebook, X/Twitter, YouTube)
- Email marketing, automation, lead nurturing
- Inbound marketing (attirer), Outbound (push/publicités payantes)
- Google Ads, Meta Ads, programmatique

**Marketing Traditionnel**
- Affichage publicitaire (OOH/DOOH), publicité TV et radio
- Marketing événementiel, foires et salons
- Imprimés (flyers, catalogues, brochures, PLV)
- Publicité presse et magazines

**Marketing Relationnel & Direct**
- CRM, fidélisation client, programmes de récompenses
- Email et SMS marketing personnalisés
- Service client et expérience utilisateur (UX)
- Marketing de recommandation (referral)

**Marketing d'Influence**
- Macro, micro et nano-influenceurs
- Stratégies de partenariats avec des créateurs de contenu
- UGC (User Generated Content)
- Analyse de performance et ROI des campagnes d'influence

Réponds toujours en français, de manière claire, structurée et actionnable. Fournis des exemples concrets et des recommandations pratiques adaptées au contexte de l'utilisateur.`;

router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const convos = await db
    .select()
    .from(conversations)
    .orderBy(asc(conversations.createdAt));
  res.json(convos.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [convo] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();

  res.status(201).json({ ...convo, createdAt: convo.createdAt.toISOString() });
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  res.json({
    ...convo,
    createdAt: convo.createdAt.toISOString(),
    messages: msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListOpenaiMessagesParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendOpenaiMessageParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: parsed.data.content,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  const chatMessages = [
    { role: "system" as const, content: MARKETING_SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/openai/generate-image", async (req, res): Promise<void> => {
  const parsed = GenerateOpenaiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
  const buffer = await generateImageBuffer(
    parsed.data.prompt,
    (parsed.data.size as "1024x1024" | "1536x1024" | "1024x1536") ?? "1024x1024"
  );
  res.json({ b64_json: buffer.toString("base64") });
});

export default router;
