import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { eq, asc, desc, and, or, lte, inArray } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  campaigns,
  landingPages,
  leads,
  scheduledPosts,
  agencyCampaigns,
  localUsers,
  systemEvents,
  businessProfiles,
  seoKeywordSets,
  type CampaignBusinessContext,
  type AgencyBrief,
  type AgencyPlan,
  type AgencyPlannedPost,
  type AgencyDecision,
  type BusinessProfile,
} from "@workspace/db";
import type { AuthedRequest } from "../../middlewares/auth";

function uid(req: Request): string {
  return (req as AuthedRequest).userId;
}
import { openai } from "@workspace/integrations-openai-ai-server";
import { sendEmail } from "../../lib/email";
import { publishToMeta, isMetaConfigured, getMetaProfile, getTokenStatus } from "../../lib/meta";
import { uploadPublicBuffer } from "../../lib/objectStorage";
import { logger } from "../../lib/logger";
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

const MARKETING_SYSTEM_PROMPT = `Tu es un expert en marketing avec une connaissance approfondie de tous les domaines du marketing. Tu aides les professionnels et entrepreneurs à développer leurs stratégies marketing, en particulier les campagnes 100% gratuites et accessibles à tous les budgets.

---

## CAMPAGNES MARKETING GRATUITES — Expertise complète

Tu maîtrises en profondeur les 7 grandes familles de campagnes marketing gratuites suivantes. Pour chacune, tu es capable de guider l'utilisateur étape par étape dans leur mise en place.

---

### 1. Marketing de Contenu (Content Marketing)
Créer et partager du contenu à forte valeur ajoutée pour éduquer, divertir ou informer sa cible.

**Types de contenu gratuits :**
- **Articles de blog & Guides** : rédiger des articles optimisés SEO qui répondent aux vraies questions des internautes (format how-to, listes, études de cas). Plateformes gratuites : WordPress.com, Medium, Substack.
- **Livres blancs & E-books** : document PDF détaillé offert en échange d'une adresse e-mail (lead magnet). Outil gratuit : Canva pour la mise en page.
- **Infographies** : visuels de données facilement partageables sur les réseaux et Pinterest. Canva, Piktochart (version gratuite).
- **Vidéos & Webinaires** : tutoriels YouTube, vidéos courtes TikTok/Reels, webinaires gratuits sur Zoom ou StreamYard.
- **Podcasts** : contenu audio long format pour construire une audience fidèle. Hébergement gratuit : Anchor (Spotify for Podcasters).
- **Newsletters** : contenu régulier envoyé à une base abonnés via Substack (gratuit), Brevo ou Mailchimp (plan gratuit).

**Étapes de mise en place :**
1. Définir sa cible (persona) et ses questions récurrentes
2. Créer un calendrier éditorial (fréquence, formats, canaux)
3. Produire le contenu avec des outils gratuits (Canva, Google Docs, CapCut)
4. Publier et distribuer (blog, réseaux sociaux, newsletter)
5. Mesurer les résultats (Google Analytics gratuit, stats natives des plateformes)

---

### 2. Référencement Naturel (SEO)
Optimiser son site web pour remonter gratuitement dans les résultats Google sur des requêtes ciblées.

**Composantes clés :**
- **SEO On-Page** : balises title, meta description, Hn (H1/H2/H3), mots-clés dans le contenu, maillage interne
- **SEO Technique** : vitesse de chargement (Core Web Vitals), mobile-first, sitemap XML, robots.txt, HTTPS
- **SEO Off-Page** : netlinking (backlinks) via partenariats, RP, annuaires, guest blogging
- **SEO Local** : Google Business Profile, citations locales, avis clients

**Outils gratuits incontournables :**
- Google Search Console (analyse positions, erreurs d'indexation)
- Google Analytics 4 (trafic, comportements)
- Ubersuggest (version gratuite, recherche de mots-clés)
- AnswerThePublic (questions des internautes)
- Yoast SEO (plugin WordPress gratuit)
- PageSpeed Insights (performance technique)

**Étapes de mise en place :**
1. Audit technique du site (Google Search Console)
2. Recherche de mots-clés à fort potentiel et faible concurrence
3. Optimisation des pages existantes (title, meta, contenu)
4. Création de nouveaux contenus ciblant ces mots-clés
5. Développement du netlinking (partenariats, mentions presse)
6. Suivi mensuel des positions et ajustements

---

### 3. Marketing sur les Réseaux Sociaux (Social Media Organique)
Utiliser les plateformes sociales sans budget publicitaire pour créer et animer une communauté.

**Plateformes et stratégies :**
- **Instagram** : Reels (portée maximale), Stories (engagement quotidien), carrousels (partages), hashtags pertinents
- **TikTok** : vidéos courtes virales, tendances (sons, challenges), contenu authentique et répétitif
- **LinkedIn** : posts texte à forte valeur (tips, retours d'expérience), articles longs, engagement dans les commentaires
- **Facebook** : groupes thématiques (animés = fort engagement), posts dans des groupes existants, Lives
- **YouTube** : vidéos longues (tutoriels, formations), Shorts (format court viral)
- **Pinterest** : épingles vers son site (trafic durable), idéal pour e-commerce, food, déco, mode
- **X / Twitter** : veille sectorielle, partage d'expertise, networking professionnel

**Social Selling & Groupes :**
- Créer ou animer un groupe Facebook / LinkedIn comme espace d'échange expert
- Participer activement dans des groupes existants pour générer de la notoriété
- DM (messages directs) pour prospecter sans publicité (LinkedIn Sales Navigator version gratuite)

**Étapes de mise en place :**
1. Choisir 1-2 plateformes prioritaires selon sa cible
2. Optimiser son profil (bio, photo, lien, mots-clés)
3. Définir une ligne éditoriale (thèmes, ton, formats)
4. Publier avec régularité (3-5x/semaine minimum)
5. Engager activement (répondre aux commentaires, interagir avec sa communauté)
6. Analyser les statistiques natives et ajuster le contenu

---

### 4. Marketing par E-mail (E-mailing)
Communiquer directement avec une base de contacts consentants pour fidéliser, informer et vendre.

**Types de campagnes gratuites :**
- **Newsletter régulière** : contenu de valeur envoyé hebdomadairement ou mensuellement
- **Séquence de bienvenue** : emails automatiques envoyés après inscription (présentation, valeur, offre)
- **Séquence de nurturing** : série d'emails éducatifs pour convertir un prospect en client
- **Email de relance panier** : rappel automatique pour e-commerce (taux de conversion élevé)
- **Email d'anniversaire / fidélisation** : personnalisation pour renforcer la relation client

**Outils gratuits :**
- **Brevo (ex-Sendinblue)** : 300 emails/jour gratuits, automation incluse
- **Mailchimp** : 500 contacts et 1 000 emails/mois gratuits
- **Substack** : newsletters gratuites avec monétisation optionnelle
- **MailerLite** : 1 000 abonnés gratuits avec automation

**Étapes de mise en place :**
1. Choisir un outil emailing adapté (Brevo recommandé pour les débutants)
2. Créer un formulaire d'inscription et un lead magnet attractif
3. Rédiger la séquence de bienvenue (3-5 emails)
4. Définir la cadence de la newsletter
5. Segmenter la liste selon les centres d'intérêt ou comportements
6. Analyser les taux d'ouverture et de clics, A/B tester les objets

---

### 5. Relations Publiques (RP) & Buzz / Guerilla Marketing
Obtenir de la visibilité médiatique sans payer, ou créer des actions marquantes à budget zéro.

**Relations Publiques gratuites :**
- **Communiqué de presse** : rédiger un communiqué structuré et l'envoyer aux journalistes, blogueurs et médias locaux/sectoriels (via LinkedIn, email direct, HARO)
- **HARO (Help A Reporter Out)** : répondre aux demandes de sources des journalistes → obtenir des citations dans la presse
- **Guest blogging** : rédiger des articles invités sur des sites à forte audience en échange d'un backlink
- **Podcasts invités** : se faire inviter dans des podcasts de sa niche pour toucher une nouvelle audience
- **Partenariats de co-marketing** : collaborer avec des marques complémentaires pour des actions communes (webinaires, concours croisés)

**Guerilla Marketing :**
- Actions créatives, inattendues ou décalées dans l'espace public pour générer du buzz organique
- Stickers, street art éphémère, flash mob, installations surprenantes
- Détournements créatifs de codes culturels partagés
- Objectif : générer des partages massifs sur les réseaux sociaux

**Étapes de mise en place (RP) :**
1. Identifier les médias, blogueurs et journalistes pertinents dans sa niche
2. Construire une liste de contacts presse (nom, email, thématiques couvertes)
3. Rédiger un communiqué percutant (accroche, angle original, chiffres clés)
4. Personnaliser chaque envoi (ne jamais envoyer un mail groupé générique)
5. Relancer poliment une semaine après si pas de réponse
6. Amplifier les retombées presse sur ses propres canaux (réseaux sociaux, newsletter)

---

### 6. Référencement Local (Local Marketing)
Indispensable pour les commerces physiques, artisans, restaurants, prestataires de services locaux.

**Leviers gratuits :**
- **Google Business Profile (GBP)** : créer et optimiser sa fiche pour apparaître sur Google Maps et dans les résultats locaux ("near me")
  - Compléter toutes les informations (horaires, photos, description, catégories)
  - Publier des posts réguliers (actualités, offres, événements)
  - Répondre à tous les avis (positifs et négatifs)
  - Activer les messages directs
- **Pages locales sur les annuaires** : Pages Jaunes, Yelp, Tripadvisor, Trustpilot, annuaires sectoriels
- **Avis clients** : encourager activement les clients satisfaits à laisser un avis Google (impact majeur sur le classement local)
- **Citations locales** : cohérence NAP (Nom, Adresse, Téléphone) sur tous les annuaires
- **Événements locaux** : participer ou co-organiser des événements de quartier, salons locaux

**Étapes de mise en place :**
1. Créer ou revendiquer sa fiche Google Business Profile
2. Compléter 100% du profil (photos, horaires, description riche en mots-clés locaux)
3. Mettre en place une routine de collecte d'avis clients (email post-achat, QR code en magasin)
4. Publier 1-2 posts/semaine sur GBP
5. S'inscrire sur les principaux annuaires locaux (cohérence NAP)
6. Surveiller et répondre à tous les avis dans les 24-48h

---

### 7. Marketing de Recommandation (Bouche-à-oreille / Referral)
Transformer ses clients satisfaits en ambassadeurs actifs de la marque.

**Types de programmes gratuits :**
- **Programme de parrainage** : récompenser les clients qui recommandent la marque à leurs proches (réductions, crédits, cadeaux, accès exclusifs)
- **Programme d'ambassadeurs** : sélectionner des clients fidèles pour représenter la marque (statut, avantages, reconnaissance)
- **Avis et témoignages** : solliciter activement des témoignages (texte, vidéo) utilisables en preuve sociale
- **UGC (User Generated Content)** : encourager les clients à partager leur expérience sur les réseaux avec un hashtag dédié
- **Concours viraux** : "Gagne X en taguant un ami" pour amplifier la portée organique

**Mécaniques de viralité :**
- Loop de viralité : chaque client invité peut lui-même inviter d'autres personnes
- Double récompense : le parrain ET le filleul sont récompensés (taux de conversion supérieur)
- Partage social intégré : simplifier au maximum le partage (lien unique, un clic)

**Outils gratuits :**
- ReferralHero (plan gratuit limité)
- Viral Loops (essai gratuit)
- Système maison : lien de parrainage unique + code promo tracké dans son CRM ou tableur

**Étapes de mise en place :**
1. Définir la récompense (côté parrain et côté filleul) — la récompense doit avoir de la valeur perçue
2. Choisir le mécanisme de tracking (code promo, lien unique, outil dédié)
3. Créer une page d'atterrissage simple expliquant le programme
4. Communiquer le programme à sa base clients existante (email, réseaux, en magasin)
5. Relancer régulièrement les participants (newsletters, rappels)
6. Mesurer : taux de participation, nombre de filleuls, CA généré

---

## DOMAINES COMPLÉMENTAIRES

**Marketing Digital & Inbound/Outbound**
- SEO/SEM, Google Ads, Meta Ads, programmatique
- Inbound marketing (attirer), Outbound (push/publicités payantes)
- Lead generation, tunnels de vente, landing pages

**Marketing Traditionnel**
- Affichage publicitaire (OOH/DOOH), TV, radio, presse
- Marketing événementiel, foires et salons
- Imprimés (flyers, catalogues, brochures, PLV)

**Marketing Relationnel & Direct**
- CRM (HubSpot gratuit, Notion), fidélisation, programmes de récompenses
- SMS marketing, expérience client (UX/CX)

**Marketing d'Influence**
- Macro, micro et nano-influenceurs
- Partenariats créateurs de contenu, UGC
- ROI des campagnes d'influence

---

## INSTRUCTIONS COMPORTEMENTALES

- Réponds **toujours en français**, de manière claire, structurée et actionnable
- Fournis des **étapes concrètes et numérotées** pour chaque stratégie
- Recommande en priorité les **outils gratuits** sauf si l'utilisateur précise avoir un budget
- Adapte tes conseils au **secteur, à la taille de l'entreprise et aux ressources disponibles** de l'utilisateur
- Si l'utilisateur ne précise pas son contexte, **pose des questions de qualification** avant de répondre
- Utilise des **exemples concrets** pour illustrer chaque concept
- Propose toujours un **plan d'action priorisé** : quoi faire en premier, deuxième, troisième
- Lorsque c'est pertinent, signale les **pièges courants** et comment les éviter

## CAPACITÉS D'EXÉCUTION DIRECTE

Tu peux exécuter de vraies actions marketing pour l'utilisateur (pas seulement conseiller) :
- **Envoyer des e-mails réels** via Resend (newsletters, relances, annonces)
- **Publier directement sur Facebook et Instagram** via la Meta Graph API (posts texte sur Facebook, posts image avec légende sur Facebook et Instagram, programmation)
- **Générer des visuels IA** prêts à publier
- **Programmer des publications** pour publication automatique à la date choisie
- **Créer des pages de capture de leads** publiques

Quand l'utilisateur veut publier sur Facebook ou Instagram, propose-lui d'utiliser la boîte à outils (bouton « Programmer ») ou le bouton « Publier maintenant ». Instagram exige une image accessible publiquement (URL HTTPS).
`;

router.get("/openai/conversations", async (req, res): Promise<void> => {
  const convos = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, uid(req)))
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
    .values({ title: parsed.data.title, userId: uid(req) })
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
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, uid(req))));

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
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, uid(req))))
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

  const [convo] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, uid(req))));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
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
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, uid(req))));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: parsed.data.content,
    userId: uid(req),
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  const chatMessages = [
    { role: "system" as const, content: MARKETING_SYSTEM_PROMPT + (await getBusinessContextPrompt(uid(req))) },
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
    userId: uid(req),
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/openai/analyze-url", async (req, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let siteContent = `URL: ${url}`;
  try {
    const fetchResponse = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketingAgentBot/1.0)" },
    });
    const html = await fetchResponse.text();
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
    siteContent = `URL: ${url}\n\nContenu extrait:\n${text}`;
  } catch (_) {
    // Continue with just the URL if fetch fails
  }

  const analysisPrompt = `Analyse ce site web et propose les campagnes marketing gratuites les plus adaptées pour le promouvoir.

${siteContent}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans bloc de code) avec cette structure exacte :
{
  "businessInfo": {
    "name": "nom détecté de l'entreprise ou marque",
    "sector": "secteur d'activité détecté",
    "audience": "cible / persona probable",
    "objective": "objectif marketing principal probable",
    "tone": "professionnel"
  },
  "suggestedCampaigns": [
    {
      "id": "seo",
      "title": "Référencement Naturel (SEO)",
      "reasoning": "Pourquoi cette campagne est prioritaire pour ce site (1-2 phrases concrètes)",
      "priority": 1
    }
  ]
}

Les ids valides pour suggestedCampaigns sont : content, seo, social, email, pr, local, referral.
Inclus LES 7 campagnes, triées par pertinence décroissante pour ce site (priority 1 = la plus adaptée).`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 1500,
    messages: [
      { role: "system", content: MARKETING_SYSTEM_PROMPT + (await getBusinessContextPrompt(uid(req))) },
      { role: "user", content: analysisPrompt },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "{}";
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawContent);
    res.json(parsed);
  } catch (_) {
    res.status(500).json({ error: "Impossible d'analyser la réponse" });
  }
});

router.post("/openai/send-email", async (req, res): Promise<void> => {
  const { to, subject, body, from } = req.body as {
    to?: string[] | string;
    subject?: string;
    body?: string;
    from?: string;
  };

  const recipients = Array.isArray(to) ? to.filter(Boolean) : to ? [to] : [];
  if (recipients.length === 0 || !subject || !body) {
    res.status(400).json({ error: "to, subject et body sont requis" });
    return;
  }

  const result = await sendEmail({ to: recipients, subject, body, from });
  if (result.success) {
    res.json({ success: true, provider: result.provider, recipients: recipients.length });
    return;
  }
  if (result.provider !== "none") {
    req.log.error({ provider: result.provider, error: result.error }, "Email send failed");
    res.status(502).json({ error: `Le fournisseur (${result.provider}) a refusé l'envoi`, details: result.error, provider: result.provider });
    return;
  }

  // No provider configured
  res.status(503).json({
    error: "Aucun fournisseur email connecté. Connectez Sendgrid ou Resend pour activer l'envoi automatique.",
    provider: "none",
  });
});

function buildCampaignPrompt(type: string, ctx: CampaignBusinessContext): string {
  const baseInfo = `
**Entreprise/Marque :** ${ctx.businessName}
**Secteur :** ${ctx.sector}
**Cible / Persona :** ${ctx.audience}
**Objectif :** ${ctx.objective}
**Ton :** ${ctx.tone}${ctx.extra ? `\n**Informations supplémentaires :** ${ctx.extra}` : ""}
`;

  const prompts: Record<string, string> = {
    content: `Tu es mandaté pour créer une CAMPAGNE COMPLÈTE de Marketing de Contenu pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants, prêts à copier-coller et utiliser sans modification :

## 📅 Calendrier Éditorial — 4 semaines
Tableau : Semaine | Jour | Format | Sujet/Titre | Plateforme

## ✍️ Article de Blog #1
Titre accrocheur + article complet de 400 mots optimisé SEO (H1, H2, H3, introduction, développement, conclusion, CTA)

## ✍️ Article de Blog #2
Titre accrocheur + article complet de 400 mots (même format)

## 📧 Newsletter — Prête à envoyer
Objet accrocheur | Préheader | Corps complet avec sections et CTA final

## 🖼️ 5 Concepts d'Infographies
Pour chaque : Titre + données à visualiser + format recommandé + plateforme cible

## 🎬 3 Scripts Vidéo / Reels
Pour chaque : Accroche 3 secondes + contenu 30-60s + CTA

---
Génère TOUT le contenu ci-dessus, complet et prêt à l'emploi. Ne résume pas, CRÉE directement.`,

    seo: `Tu es mandaté pour créer une STRATÉGIE SEO COMPLÈTE pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants :

## 🔑 Recherche de Mots-Clés — 15 mots-clés ciblés
Tableau : Mot-clé | Volume estimé | Difficulté (1-10) | Intention de recherche | Priorité

## 🏠 Optimisation Page d'Accueil
Balise Title (60 car.) | Meta Description (160 car.) | H1 proposé | Structure des sections | Maillage interne recommandé (5 liens internes)

## ✍️ Plan d'Article SEO #1 — [mot-clé prioritaire n°1]
Title SEO + Meta + Plan détaillé H2/H3 + Introduction complète (200 mots)

## ✍️ Plan d'Article SEO #2 — [mot-clé prioritaire n°2]
Même format complet

## ✍️ Plan d'Article SEO #3 — [mot-clé n°3]
Même format complet

## 🔗 Stratégie Netlinking Gratuit
10 actions concrètes pour obtenir des backlinks (guest blogging, annuaires, RP, partenariats...)

## 📊 Plan d'Action SEO — 90 jours
Tableau : Semaines 1-4 | Semaines 5-8 | Semaines 9-12 (actions prioritaires par phase)

---
Génère TOUT le contenu ci-dessus, complet et actionnable.`,

    social: `Tu es mandaté pour créer une CAMPAGNE RÉSEAUX SOCIAUX COMPLÈTE pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants :

## 📱 10 Posts Prêts à Publier
Pour chaque post : Plateforme | Visuel suggéré | Caption complète | Hashtags (20-30) | Heure conseillée

## 🎬 5 Scripts Reels / TikTok
Pour chaque : Accroche (3 sec) | Déroulé (30-60s) | CTA final | Son/musique suggéré

## 📅 Calendrier de Publication — 30 jours
Tableau : Semaine | Lundi | Mercredi | Vendredi | Samedi | Format | Thème

## 💬 3 Idées de Carrousels / Stories Interactifs
Pour chaque : Slides 1 à 6 avec contenu + question/sondage à inclure

## 🤝 Plan Social Selling — 15 min/jour
Script de prise de contact en DM | 5 groupes/communautés à rejoindre | Routine d'engagement quotidien

---
Génère TOUT le contenu ci-dessus, complet et prêt à publier immédiatement.`,

    email: `Tu es mandaté pour créer une CAMPAGNE E-MAIL COMPLÈTE pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants :

## 📧 Séquence de Bienvenue — 5 Emails Complets
Pour chaque email : Objet | Préheader | Corps COMPLET avec intro, développement, CTA | Délai d'envoi
- Email 1 (J+0) : Bienvenue + valeur immédiate
- Email 2 (J+2) : Histoire de la marque + problème résolu
- Email 3 (J+4) : Ressource gratuite ou conseil premium
- Email 4 (J+7) : Preuve sociale (témoignages, résultats)
- Email 5 (J+10) : Offre ou invitation à l'action principale

## 📰 Newsletter Mensuelle Type — Complète
Objet accrocheur | Préheader | Éditorial (150 mots) | Section "Bon à savoir" (3 items) | CTA principal

## 📢 Email de Relance Inactifs
Objet urgence/curiosité | Corps court et percutant | CTA de re-engagement

## 💡 3 Lead Magnets à Créer
Pour chaque : Titre | Format | Contenu résumé (10 points) | Texte du formulaire d'inscription

---
Génère TOUT le contenu ci-dessus, complet et prêt à envoyer.`,

    pr: `Tu es mandaté pour créer une CAMPAGNE RELATIONS PUBLIQUES COMPLÈTE pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants :

## 📰 Communiqué de Presse Complet
Titre accrocheur | Sous-titre | Lieu/Date | Chapô (2-3 phrases) | Corps (3 paragraphes complets) | Citation du dirigeant | À propos | Contacts presse

## 📋 20 Médias / Journalistes à Cibler
Tableau : Média | Rubrique/Section | Type de contenu | Angle recommandé | Mode de contact

## 📬 Email de Démarchage Presse — Prêt à envoyer
Objet percutant | Corps personnalisé complet | P.S. accrocheur | Template de relance J+7

## 🎯 3 Angles de Communication Originaux
Pour chaque : Titre de l'angle | Pourquoi ça intéresse les médias | Comment le présenter

## 🎭 Concept de Guerilla Marketing
Idée créative détaillée | Lieu/contexte | Matériel nécessaire | Plan de viralisation | Hashtag campagne

## 🎙️ 5 Podcasts / Blogs pour Guest Posting
Pour chaque : Nom | Audience estimée | Sujet d'article proposé | Email de candidature complet

---
Génère TOUT le contenu ci-dessus, complet et prêt à utiliser.`,

    local: `Tu es mandaté pour créer une CAMPAGNE MARKETING LOCAL COMPLÈTE pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants :

## 📍 Optimisation Google Business Profile
Description optimisée (750 caractères exactement) | Catégories à cocher | 10 mots-clés locaux | Checklist complète (25 points) des informations à remplir

## 📸 Plan de Contenu Photo GBP
20 types de photos avec description détaillée + conseils de prise de vue + légendes optimisées

## 📢 5 Posts Google Business Profile — Prêts à publier
Pour chaque : Texte complet (300 mots max) | Type de post | Bouton CTA | Image suggérée

## ⭐ Stratégie de Collecte d'Avis — 5 outils
Email post-achat complet | SMS de demande | Script verbal en boutique | QR code (texte descriptif) | 3 réponses-type aux avis négatifs

## 📋 25 Annuaires Locaux à Rejoindre
Tableau : Nom | URL | Catégorie pertinente | Informations à renseigner | Impact SEO estimé

## 🏘️ 5 Partenariats Locaux à Développer
Pour chaque : Type de partenaire | Action proposée | Bénéfice mutuel | Script d'approche

---
Génère TOUT le contenu ci-dessus, complet et actionnable.`,

    referral: `Tu es mandaté pour créer un PROGRAMME DE RECOMMANDATION COMPLET pour :
${baseInfo}
Génère IMMÉDIATEMENT tous les livrables suivants :

## 🤝 Structure du Programme
Nom du programme | Récompense parrain | Récompense filleul | Conditions | Durée | Outil de tracking recommandé + configuration

## 📄 Page de Présentation — Contenu Complet
Titre accrocheur | Sous-titre | Comment ça marche (3 étapes) | Avantages clés (6 bullet points) | FAQ (5 Q/R) | CTA principal

## 📧 Email d'Annonce aux Clients — Complet
Objet | Préheader | Corps entier avec storytelling + CTA + P.S.

## 📱 3 Posts Réseaux Sociaux pour l'Annonce
Pour chaque : Caption complète + hashtags adaptés

## 💌 Email de Relance Parrain J+15 — Complet
Pour relancer ceux qui n'ont pas encore parrainé

## ⭐ Programme Ambassadeurs
Critères de sélection | Avantages exclusifs (10 idées) | Kit de contenu à fournir | Email de recrutement complet

## 📊 Dashboard de Suivi
5 KPIs clés avec objectifs chiffrés + outils gratuits de mesure + fréquence de suivi

---
Génère TOUT le contenu ci-dessus, complet et prêt à lancer.`,
  };

  return prompts[type] ?? prompts["content"];
}

router.get("/openai/campaigns", async (req, res): Promise<void> => {
  const result = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.userId, uid(req)))
    .orderBy(desc(campaigns.createdAt));
  res.json(result.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.delete("/openai/campaigns/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid campaign id" });
    return;
  }
  const [deleted] = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, uid(req))))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/openai/campaigns/generate", async (req, res): Promise<void> => {
  const { title, type, businessContext } = req.body as {
    title: string;
    type: string;
    businessContext: CampaignBusinessContext;
  };

  if (!title || !type || !businessContext) {
    res.status(400).json({ error: "title, type, and businessContext are required" });
    return;
  }

  const [convo] = await db.insert(conversations).values({ title, userId: uid(req) }).returning();

  const [campaign] = await db
    .insert(campaigns)
    .values({ title, type, businessContext, conversationId: convo.id, userId: uid(req) })
    .returning();

  const userPrompt = buildCampaignPrompt(type, businessContext);

  await db.insert(messages).values({
    conversationId: convo.id,
    role: "user",
    content: userPrompt,
    userId: uid(req),
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: MARKETING_SYSTEM_PROMPT + (await getBusinessContextPrompt(uid(req))) },
      { role: "user", content: userPrompt },
    ],
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
    conversationId: convo.id,
    role: "assistant",
    content: fullResponse,
    userId: uid(req),
  });

  res.write(
    `data: ${JSON.stringify({ done: true, campaignId: campaign.id, conversationId: convo.id })}\n\n`
  );
  res.end();
});

const ALLOWED_IMAGE_SIZES = new Set([
  "1024x1024",
  "512x512",
  "256x256",
  "1536x1024",
  "1024x1536",
]);

router.post("/openai/generate-image", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as { prompt?: unknown; size?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sizeRaw = typeof body.size === "string" ? body.size : "1024x1024";
  if (!prompt || prompt.length > 2000) {
    res.status(400).json({ error: "prompt requis (max 2000 caractères)" });
    return;
  }
  if (!ALLOWED_IMAGE_SIZES.has(sizeRaw)) {
    res.status(400).json({ error: `size invalide. Valeurs: ${[...ALLOWED_IMAGE_SIZES].join(", ")}` });
    return;
  }

  const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
  const buffer = await generateImageBuffer(
    prompt,
    sizeRaw as "1024x1024" | "1536x1024" | "1024x1536"
  );
  res.json({ b64_json: buffer.toString("base64") });
});

// ════════════════════════════════════════════════════════════════════════════
// LANDING PAGES (lead capture)
// ════════════════════════════════════════════════════════════════════════════

router.get("/landing-pages", async (req, res) => {
  const list = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.userId, uid(req)))
    .orderBy(desc(landingPages.createdAt));
  res.json(list);
});

router.post("/landing-pages", async (req, res) => {
  const { slug, title, headline, subheadline, ctaLabel, successMessage, fields, style, conversationId } =
    req.body as Partial<{
      slug: string;
      title: string;
      headline: string;
      subheadline: string;
      ctaLabel: string;
      successMessage: string;
      fields: string[];
      style: Record<string, string>;
      conversationId: number;
    }>;
  if (!slug || !title || !headline) {
    res.status(400).json({ error: "slug, title et headline sont requis" });
    return;
  }
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  try {
    const [created] = await db
      .insert(landingPages)
      .values({
        slug: cleanSlug,
        title,
        headline,
        subheadline: subheadline ?? "",
        ctaLabel: ctaLabel ?? "Je m'inscris",
        successMessage: successMessage ?? "Merci ! Nous vous recontactons très vite.",
        fields: fields ?? ["name", "email"],
        style: style ?? {},
        conversationId: conversationId ?? null,
        userId: uid(req),
      })
      .returning();
    res.status(201).json(created);
  } catch (e: unknown) {
    res.status(400).json({ error: "Ce slug est déjà utilisé. Choisissez-en un autre." });
  }
});

router.delete("/landing-pages/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db
    .delete(landingPages)
    .where(and(eq(landingPages.id, id), eq(landingPages.userId, uid(req))));
  res.json({ success: true });
});

router.get("/landing-pages/:id/leads", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [page] = await db
    .select({ id: landingPages.id })
    .from(landingPages)
    .where(and(eq(landingPages.id, id), eq(landingPages.userId, uid(req))));
  if (!page) {
    res.status(404).json({ error: "Page introuvable" });
    return;
  }
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.landingPageId, id))
    .orderBy(desc(leads.createdAt));
  res.json(rows);
});

// Public landing routes are mounted via `routes/public-landing.ts` BEFORE auth.

// ════════════════════════════════════════════════════════════════════════════
// SCHEDULED POSTS
// ════════════════════════════════════════════════════════════════════════════

router.get("/scheduled-posts", async (req, res) => {
  const list = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.userId, uid(req)))
    .orderBy(asc(scheduledPosts.scheduledFor));
  res.json(list);
});

router.post("/scheduled-posts", async (req, res): Promise<void> => {
  const { title, content, platform, scheduledFor, meta, conversationId } = req.body as Partial<{
    title: string;
    content: string;
    platform: string;
    scheduledFor: string;
    meta: { recipients?: string[]; subject?: string; notes?: string; imageUrl?: string };
    conversationId: number;
  }>;
  if (!title || !content || !platform || !scheduledFor) {
    res.status(400).json({ error: "title, content, platform, scheduledFor sont requis" });
    return;
  }
  // FB/IG utilisent les credentials admin globaux : un non-admin ne doit pas
  // pouvoir programmer un post qui finirait par être rejeté silencieusement
  // par le worker (ou — sans le fix worker — publié sur les pages admin).
  if ((platform === "facebook" || platform === "instagram") && (req as unknown as { isAdmin?: boolean }).isAdmin !== true) {
    res.status(403).json({
      error: "Facebook et Instagram ne sont pas encore disponibles sur ton compte. Utilise LinkedIn ou Email en attendant.",
      code: "platform_not_available",
    });
    return;
  }
  const date = new Date(scheduledFor);
  if (isNaN(date.getTime())) {
    res.status(400).json({ error: "scheduledFor invalide" });
    return;
  }

  // Auto-generate a visual for Facebook/Instagram posts that don't already have one.
  // Non-blocking conceptually but awaited so the response carries the final imageUrl.
  // If generation fails, we still create the post without an image.
  const finalMeta: Record<string, unknown> = { ...(meta ?? {}) };
  const isSocial = platform === "facebook" || platform === "instagram";
  if (isSocial && !finalMeta["imageUrl"]) {
    try {
      const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
      const promptSeed = content.slice(0, 400);
      const visualPrompt = `Visuel pour réseaux sociaux, style photo professionnelle, ambiance moderne et engageante. Sujet : ${promptSeed}. Pas de texte sur l'image.`;
      const buffer = await generateImageBuffer(visualPrompt, "1024x1024");
      const uploaded = await uploadPublicBuffer(buffer, { ext: "png", contentType: "image/png" });
      finalMeta["imageUrl"] = uploaded.publicUrl;
      req.log.info({ url: uploaded.publicUrl }, "Auto-generated social image");
    } catch (err) {
      req.log.warn({ err }, "Auto image generation failed, scheduling without image");
    }
  }

  const [created] = await db
    .insert(scheduledPosts)
    .values({
      title,
      content,
      platform,
      scheduledFor: date,
      meta: finalMeta,
      conversationId: conversationId ?? null,
      status: "pending",
      userId: uid(req),
    })
    .returning();
  res.status(201).json(created);
});

router.delete("/scheduled-posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db
    .delete(scheduledPosts)
    .where(and(eq(scheduledPosts.id, id), eq(scheduledPosts.userId, uid(req))));
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// META (Facebook / Instagram) — direct publish
// ════════════════════════════════════════════════════════════════════════════

function serializeProfile(p: BusinessProfile | null) {
  if (!p) {
    return {
      id: null,
      firstName: null,
      lastName: null,
      businessName: null,
      activity: null,
      targetAudience: null,
      companyWebsite: null,
      description: null,
      tone: null,
      language: null,
      primaryGoal: null,
      goals: [] as string[],
      onboardingCompleted: false,
    };
  }
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    businessName: p.businessName,
    activity: p.activity,
    targetAudience: p.targetAudience,
    companyWebsite: p.companyWebsite,
    description: p.description,
    tone: p.tone,
    language: p.language,
    primaryGoal: p.primaryGoal,
    goals: p.goals ?? [],
    onboardingCompleted: p.onboardingCompleted === "true",
  };
}

router.get("/openai/business-profile", async (req, res): Promise<void> => {
  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, uid(req)))
    .limit(1);
  res.json(serializeProfile(profile ?? null));
});

const businessProfileInputSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  activity: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  companyWebsite: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  primaryGoal: z.string().nullable().optional(),
  goals: z.array(z.string()).optional(),
  onboardingCompleted: z.boolean().optional(),
});

router.put("/openai/business-profile", async (req, res): Promise<void> => {
  const parsed = businessProfileInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  const [existing] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, uid(req)))
    .limit(1);
  const pick = <K extends keyof typeof body>(k: K, fallback: BusinessProfile[K & keyof BusinessProfile] | null) =>
    k in body ? (body[k] as BusinessProfile[K & keyof BusinessProfile] | null) : (existing?.[k as keyof BusinessProfile] ?? fallback) as BusinessProfile[K & keyof BusinessProfile] | null;

  const values = {
    firstName: pick("firstName", null),
    lastName: pick("lastName", null),
    businessName: pick("businessName", null),
    activity: pick("activity", null),
    targetAudience: pick("targetAudience", null),
    companyWebsite: pick("companyWebsite", null),
    description: pick("description", null),
    tone: pick("tone", null),
    language: pick("language", null),
    primaryGoal: pick("primaryGoal", null),
    goals: ("goals" in body ? body.goals : existing?.goals) ?? [],
    onboardingCompleted:
      "onboardingCompleted" in body
        ? (body.onboardingCompleted ? "true" : "false")
        : (existing?.onboardingCompleted ?? "false"),
    updatedAt: new Date(),
  };
  let saved: BusinessProfile;
  if (existing) {
    [saved] = await db
      .update(businessProfiles)
      .set(values)
      .where(eq(businessProfiles.id, existing.id))
      .returning();
  } else {
    [saved] = await db
      .insert(businessProfiles)
      .values({ ...values, userId: uid(req) })
      .returning();
  }
  res.json(serializeProfile(saved));
});

async function getBusinessContextPrompt(userId: string): Promise<string> {
  // Fail-open: any DB issue here must NOT break the chat. Return empty string and log.
  try {
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .limit(1);
    const parts: string[] = [];
    if (profile?.businessName) parts.push(`Nom de l'entreprise : ${profile.businessName}`);
    if (profile?.activity) parts.push(`Secteur d'activité : ${profile.activity}`);
    if (profile?.targetAudience) parts.push(`Cible : ${profile.targetAudience}`);
    if (profile?.companyWebsite) parts.push(`Site web : ${profile.companyWebsite}`);
    if (profile?.description) parts.push(`Description : ${profile.description}`);
    if (profile?.tone) parts.push(`Ton souhaité : ${profile.tone}`);
    if (profile?.language) parts.push(`Langue : ${profile.language}`);
    if (profile?.primaryGoal) parts.push(`Objectif prioritaire : ${profile.primaryGoal}`);
    if (profile?.goals && profile.goals.length > 0) parts.push(`Autres objectifs : ${profile.goals.join(", ")}`);
    let out = "";
    if (parts.length > 0) {
      out = `\n\n---\n\n## CONTEXTE DE L'UTILISATEUR (profil business)\n\nAdapte systématiquement tes recommandations à ce contexte :\n${parts.map((p) => `- ${p}`).join("\n")}`;
    }
    // Append SEO context: top keywords from the most recent generated set.
    const [latestKw] = await db
      .select()
      .from(seoKeywordSets)
      .where(eq(seoKeywordSets.userId, userId))
      .orderBy(desc(seoKeywordSets.createdAt))
      .limit(1);
    if (latestKw?.data?.keywords?.length) {
      const top = latestKw.data.keywords.slice(0, 10).map((k) => k.keyword).filter(Boolean);
      if (top.length > 0) {
        out += `\n\n## MOTS-CLÉS SEO PRIORITAIRES\n\nQuand tu rédiges des posts sociaux, articles, méta-descriptions ou hashtags, intègre NATURELLEMENT (sans bourrage) ces mots-clés cibles de l'utilisateur :\n${top.map((k) => `- ${k}`).join("\n")}\n\nPour les posts Facebook/Instagram, ajoute aussi 3 à 5 hashtags dérivés de ces mots-clés.`;
      }
    }
    return out;
  } catch (err) {
    logger.warn({ err }, "getBusinessContextPrompt failed, falling back to empty");
    return "";
  }
}

router.get("/meta/status", (req, res) => {
  // Meta credentials are global admin env secrets, not per-user.
  // Non-admin users must never see Meta as "connected" — otherwise they would
  // publish on the admin's own Facebook/Instagram pages.
  const isAdmin = (req as unknown as { isAdmin?: boolean }).isAdmin === true;
  if (!isAdmin) {
    res.json({ facebook: false, instagram: false });
    return;
  }
  res.json({
    facebook: isMetaConfigured("facebook"),
    instagram: isMetaConfigured("instagram"),
  });
});

router.get("/meta/profile", async (req, res): Promise<void> => {
  // Don't leak the admin's FB Page / IG account identity to non-admin users.
  const isAdmin = (req as unknown as { isAdmin?: boolean }).isAdmin === true;
  if (!isAdmin) {
    res.status(404).json({ error: "Profil indisponible" });
    return;
  }
  const platform = req.query["platform"];
  if (platform !== "facebook" && platform !== "instagram") {
    res.status(400).json({ error: "platform doit être 'facebook' ou 'instagram'" });
    return;
  }
  const profile = await getMetaProfile(platform);
  if (!profile) {
    res.status(412).json({ error: "Profil indisponible (token ou ID manquant)" });
    return;
  }
  res.json(profile);
});

router.post("/meta/publish", async (req, res): Promise<void> => {
  const isAdmin = (req as unknown as { isAdmin?: boolean }).isAdmin === true;
  if (!isAdmin) {
    res.status(403).json({
      error: "La publication Facebook/Instagram n'est pas disponible sur ton compte. Utilise LinkedIn pour publier.",
    });
    return;
  }
  const { platform, message, imageUrl, scheduledPostId } = req.body as Partial<{
    platform: "facebook" | "instagram";
    message: string;
    imageUrl: string;
    scheduledPostId: number;
  }>;
  if (platform !== "facebook" && platform !== "instagram") {
    res.status(400).json({ error: "platform doit être 'facebook' ou 'instagram'" });
    return;
  }
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message requis" });
    return;
  }
  const result = await publishToMeta({ platform, message, imageUrl });
  if (!result.success) {
    res.status(result.configMissing ? 412 : 502).json({ error: result.error });
    return;
  }
  // If a scheduled post id is supplied, mark it as sent (only if owned by user)
  if (typeof scheduledPostId === "number") {
    const [existing] = await db
      .select()
      .from(scheduledPosts)
      .where(and(eq(scheduledPosts.id, scheduledPostId), eq(scheduledPosts.userId, uid(req))));
    if (existing) {
      await db
        .update(scheduledPosts)
        .set({
          status: "sent",
          sentAt: new Date(),
          meta: {
            ...(existing.meta ?? {}),
            metaPostId: result.postId,
            metaPermalink: result.permalink,
          },
        })
        .where(eq(scheduledPosts.id, scheduledPostId));
    }
  }
  res.json({ success: true, postId: result.postId, permalink: result.permalink });
});

// ── Scheduler worker ────────────────────────────────────────────────────────
// Total tries before we give up and email the user. With BACKOFF_MINUTES below
// we try at T0, T+5min, T+20min, T+65min — then mark as failed.
const MAX_ATTEMPTS = 4;
// Backoff between retries — exponential: 5 min, 15 min, 45 min.
const BACKOFF_MINUTES = [5, 15, 45];
// If a post sits in "processing" longer than this, assume the worker died
// mid-publish (server restart / crash) and reclaim it back to "pending".
const PROCESSING_LEASE_MS = 5 * 60_000;
// When the Meta token / page id isn't configured, we don't fail the post —
// we park it for this long and retry, so it auto-resumes once the secret is set.
const CONFIG_MISSING_BACKOFF_MINUTES = 30;

async function notifyPostFailure(
  post: typeof scheduledPosts.$inferSelect,
  errorMsg: string,
): Promise<void> {
  const to = post.meta?.notificationEmail;
  if (!to) return;
  const channel =
    post.platform === "facebook" ? "Facebook" : post.platform === "instagram" ? "Instagram" : post.platform;
  const campaign = post.meta?.campaignName ? ` (campagne « ${post.meta.campaignName} »)` : "";
  await sendEmail({
    to: [to],
    subject: `⚠️ Un post n'a pas pu être publié sur ${channel}`,
    body: `Bonjour,

Ton assistant marketing a essayé ${MAX_ATTEMPTS} fois de publier un post sur ${channel}${campaign}, sans succès.

Détails du post :
"${post.content.slice(0, 300)}${post.content.length > 300 ? "…" : ""}"

Raison de l'échec :
${errorMsg}

Que faire ?
- Si l'erreur parle de "token" ou "session", ton code d'accès Meta a expiré : il faut le renouveler (5 minutes de manip).
- Sinon, jette un œil à l'application pour relancer la publication à la main.

— GrowIQ`,
  }).catch(() => {
    // Best effort — never let an email failure block the scheduler.
  });
}

async function handlePostFailure(
  post: typeof scheduledPosts.$inferSelect,
  errorMsg: string,
  configMissing: boolean,
): Promise<void> {
  const trimmedErr = errorMsg.slice(0, 200);
  const nextAttempt = (post.attempts ?? 0) + 1;
  // Preserve the originally-planned send time the first time we retry, so we
  // don't lose the user's intent when scheduledFor gets bumped by backoff.
  const originalScheduledFor =
    post.meta?.originalScheduledFor ?? post.scheduledFor.toISOString();

  // Config-missing → park the post and keep retrying with a long backoff so it
  // auto-resumes once the operator fixes the secret. Don't count this against
  // MAX_ATTEMPTS (a missing token is an operator problem, not a flaky API).
  if (configMissing) {
    const nextTry = new Date(Date.now() + CONFIG_MISSING_BACKOFF_MINUTES * 60_000);
    await db
      .update(scheduledPosts)
      .set({
        status: "pending",
        scheduledFor: nextTry,
        processingStartedAt: null,
        errorMessage: trimmedErr,
        meta: { ...(post.meta ?? {}), originalScheduledFor },
      })
      .where(eq(scheduledPosts.id, post.id));
    return;
  }

  if (nextAttempt >= MAX_ATTEMPTS) {
    await db
      .update(scheduledPosts)
      .set({
        status: "failed",
        attempts: nextAttempt,
        processingStartedAt: null,
        errorMessage: trimmedErr,
        meta: { ...(post.meta ?? {}), originalScheduledFor },
      })
      .where(eq(scheduledPosts.id, post.id));
    await notifyPostFailure({ ...post, attempts: nextAttempt }, trimmedErr);
    return;
  }

  // Reschedule for retry with exponential backoff (5, 15, 45 min).
  const minutes = BACKOFF_MINUTES[nextAttempt - 1] ?? 60;
  const nextTry = new Date(Date.now() + minutes * 60_000);
  await db
    .update(scheduledPosts)
    .set({
      status: "pending",
      attempts: nextAttempt,
      scheduledFor: nextTry,
      processingStartedAt: null,
      errorMessage: trimmedErr,
      meta: { ...(post.meta ?? {}), originalScheduledFor },
    })
    .where(eq(scheduledPosts.id, post.id));
}

let schedulerRunning = false;
async function processScheduledPosts(): Promise<void> {
  if (schedulerRunning) return; // prevent overlap within the same process
  schedulerRunning = true;
  try {
    // 1. Crash recovery: any post that has been "processing" for longer than the
    // lease window is assumed orphaned (server died mid-publish) and gets put
    // back into the queue. We don't bump attempts — we just retry once.
    const staleCutoff = new Date(Date.now() - PROCESSING_LEASE_MS);
    await db
      .update(scheduledPosts)
      .set({ status: "pending", processingStartedAt: null })
      .where(
        and(
          eq(scheduledPosts.status, "processing"),
          lte(scheduledPosts.processingStartedAt, staleCutoff),
        ),
      );

    // 2. Atomic claim: pending → processing in a single statement to avoid
    // duplicate sends when multiple instances or overlapping ticks run.
    const due = await db
      .update(scheduledPosts)
      .set({ status: "processing", processingStartedAt: new Date() })
      .where(and(eq(scheduledPosts.status, "pending"), lte(scheduledPosts.scheduledFor, new Date())))
      .returning();

    for (const post of due) {
      try {
        if (post.platform === "email" && post.meta?.recipients?.length) {
          const subject = post.meta.subject || post.title;
          const result = await sendEmail({
            to: post.meta.recipients,
            subject,
            body: post.content,
          });
          if (result.success) {
            await db
              .update(scheduledPosts)
              .set({
                status: "sent",
                sentAt: new Date(),
                attempts: (post.attempts ?? 0) + 1,
                processingStartedAt: null,
              })
              .where(eq(scheduledPosts.id, post.id));
          } else {
            await handlePostFailure(
              post,
              result.error ?? "Aucun fournisseur email",
              result.provider === "none",
            );
          }
        } else if (post.platform === "facebook" || post.platform === "instagram") {
          // SECURITY: Meta credentials are global admin env secrets. We MUST
          // refuse to publish FB/IG posts owned by non-admin users — otherwise
          // their scheduled posts would publish on the admin's own pages.
          let ownerIsAdmin = false;
          if (post.userId) {
            const [owner] = await db
              .select({ isAdmin: localUsers.isAdmin })
              .from(localUsers)
              .where(eq(localUsers.id, post.userId));
            ownerIsAdmin = owner?.isAdmin === true;
          } else {
            // Legacy NULL-userId rows were created before auth; treat as admin-owned.
            ownerIsAdmin = true;
          }
          if (!ownerIsAdmin) {
            await db
              .update(scheduledPosts)
              .set({
                status: "failed",
                attempts: (post.attempts ?? 0) + 1,
                processingStartedAt: null,
                errorMessage:
                  "Publication Facebook/Instagram bloquée : compte non autorisé sur les pages GrowIQ.",
              })
              .where(eq(scheduledPosts.id, post.id));
            logger.warn(
              { postId: post.id, userId: post.userId, platform: post.platform },
              "Blocked Meta publish: non-admin owner",
            );
            continue;
          }
          const result = await publishToMeta({
            platform: post.platform,
            message: post.content,
            imageUrl: post.meta?.imageUrl,
          });
          if (result.success) {
            await db
              .update(scheduledPosts)
              .set({
                status: "sent",
                sentAt: new Date(),
                attempts: (post.attempts ?? 0) + 1,
                processingStartedAt: null,
                meta: {
                  ...(post.meta ?? {}),
                  metaPostId: result.postId,
                  metaPermalink: result.permalink,
                },
              })
              .where(eq(scheduledPosts.id, post.id));
          } else {
            await handlePostFailure(post, result.error, !!result.configMissing);
          }
        } else {
          // Other platforms (linkedin, twitter, tiktok) → mark as ready for manual 1-click publish
          await db
            .update(scheduledPosts)
            .set({ status: "ready", processingStartedAt: null })
            .where(eq(scheduledPosts.id, post.id));
        }
      } catch (e: unknown) {
        await handlePostFailure(post, (e as Error).message ?? "erreur inconnue", false);
      }
    }

    // 3. After processing, check if any touched campaigns are now fully done
    // (every post either sent or failed — none still pending/processing) and
    // fire the final recap email exactly once per campaign.
    const touchedCampaignIds = new Set<number>();
    for (const p of due) {
      const cid = p.meta?.campaignId;
      if (typeof cid === "number") touchedCampaignIds.add(cid);
    }
    for (const cid of touchedCampaignIds) {
      await maybeSendCampaignRecap(cid).catch((err) => {
        logger.warn({ err, cid }, "Campaign recap check failed");
      });
    }
  } catch (_) {
    // Silent — will retry next tick
  } finally {
    schedulerRunning = false;
  }
}

/**
 * Fires the final "campaign published" email exactly once, when every post of
 * the campaign has reached a terminal state (sent or failed). Idempotent via
 * the system_events table — safe to call from every scheduler tick.
 */
async function maybeSendCampaignRecap(campaignId: number): Promise<void> {
  // Drizzle's jsonb operators are awkward; given a campaign has < ~20 posts,
  // we fetch all FB/IG posts and filter by campaignId in memory.
  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(inArray(scheduledPosts.platform, ["facebook", "instagram"]));
  const ours = posts.filter((p) => p.meta?.campaignId === campaignId);
  if (ours.length === 0) return;
  // If anything is still in-flight, wait for the next tick.
  const stillInFlight = ours.some(
    (p) => p.status === "pending" || p.status === "processing",
  );
  if (stillInFlight) return;

  // Claim the recap slot atomically — only one process will pass through.
  const claimed = await claimSystemEvent(`agency-campaign-recap-${campaignId}`);
  if (!claimed) return;

  const [campaign] = await db
    .select()
    .from(agencyCampaigns)
    .where(eq(agencyCampaigns.id, campaignId));
  if (!campaign || !campaign.notificationEmail) return;

  const sent = ours.filter((p) => p.status === "sent");
  const failed = ours.filter((p) => p.status === "failed");

  const sentLines = sent
    .map((p) => {
      const channel = p.platform === "facebook" ? "Facebook" : "Instagram";
      const when = (p.sentAt ?? p.scheduledFor).toLocaleString("fr-FR");
      const link = p.meta?.metaPermalink ? `\n  ↳ Voir : ${p.meta.metaPermalink}` : "";
      return `• ${when} — ${channel}${link}`;
    })
    .join("\n");

  const failedLines = failed
    .map((p) => {
      const channel = p.platform === "facebook" ? "Facebook" : "Instagram";
      const reason = p.errorMessage ? ` — ${p.errorMessage}` : "";
      return `• ${channel}${reason}`;
    })
    .join("\n");

  const subject =
    failed.length === 0
      ? `✅ Ta campagne "${campaign.name}" est entièrement publiée`
      : `Ta campagne "${campaign.name}" est terminée (${sent.length}/${ours.length} publiés)`;

  const body = `Bonjour,

Ta campagne « ${campaign.name} » vient de finir de tourner. Voici le bilan.

${sent.length > 0 ? `Posts publiés (${sent.length}) :\n${sentLines}\n` : ""}${failed.length > 0 ? `\nPosts qui n'ont pas pu partir (${failed.length}) :\n${failedLines}\n\nPour ceux-là, jette un œil à l'application pour relancer à la main si tu veux.\n` : ""}
Tu peux cliquer sur les liens ci-dessus pour aller voir tes posts directement sur Facebook ou Instagram.

— GrowIQ`;

  const result = await sendEmail({
    to: [campaign.notificationEmail],
    subject,
    body,
  });
  if (result.success) {
    logger.info(
      { campaignId, sent: sent.length, failed: failed.length },
      "Campaign recap email sent",
    );
  } else {
    // Email send failed — release the claim so a later tick can retry.
    // The tiny race window where two ticks both pass the claim is acceptable
    // (worst case: one duplicate email per provider outage).
    await db
      .delete(systemEvents)
      .where(eq(systemEvents.eventKey, `agency-campaign-recap-${campaignId}`));
    logger.warn(
      { err: result.error, campaignId },
      "Campaign recap email failed — claim released for retry",
    );
  }
}

/**
 * Safety net: scans all launched campaigns and triggers recap for any whose
 * posts are all in terminal state but were missed by the tick-level check
 * (e.g. server was down when the last post completed, or campaign was
 * manually fixed in the DB). Runs once every few minutes.
 */
async function sweepCampaignRecaps(): Promise<void> {
  const launched = await db
    .select({ id: agencyCampaigns.id })
    .from(agencyCampaigns)
    .where(eq(agencyCampaigns.status, "launched"));
  for (const c of launched) {
    await maybeSendCampaignRecap(c.id).catch((err) => {
      logger.warn({ err, cid: c.id }, "Recap sweep failed for campaign");
    });
  }
}

// ── Meta token expiry monitor ────────────────────────────────────────────────
// Checks once a day. Emails a reminder when the Meta access token has fewer
// than REMINDER_THRESHOLD_DAYS left, or when it has already expired.
const REMINDER_THRESHOLD_DAYS = 10;

/**
 * Durable once-per-key marker. Returns true if this is the first time we've
 * recorded the given key — false if it was already recorded. We use a PK
 * insert with onConflictDoNothing so concurrent workers / restarts can't
 * double-send.
 */
async function claimSystemEvent(eventKey: string): Promise<boolean> {
  const inserted = await db
    .insert(systemEvents)
    .values({ eventKey })
    .onConflictDoNothing()
    .returning({ eventKey: systemEvents.eventKey });
  return inserted.length > 0;
}

async function getReminderRecipient(): Promise<string | null> {
  // Use the most-recently-launched campaign's notificationEmail as the contact.
  const [latest] = await db
    .select({ email: agencyCampaigns.notificationEmail })
    .from(agencyCampaigns)
    .where(eq(agencyCampaigns.status, "launched"))
    .orderBy(desc(agencyCampaigns.launchedAt))
    .limit(1);
  return latest?.email ?? null;
}

async function checkMetaTokenHealth(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  // Durable daily gate — survives restarts so we don't spam the user.
  const ranToday = !(await claimSystemEvent(`meta-token-check-${today}`));
  if (ranToday) return;

  const status = await getTokenStatus();
  if (!status) return; // Token not configured / transient error → nothing to do.

  let subject: string | null = null;
  let body: string | null = null;
  if (!status.valid) {
    subject = "🚨 Ton code d'accès Meta a expiré";
    body = `Bonjour,

Ton code d'accès Facebook / Instagram a expiré. Les prochains posts programmés ne pourront pas être publiés tant que tu ne l'auras pas renouvelé.

Comment renouveler (5 minutes) :
1. Va sur https://developers.facebook.com/tools/explorer/
2. Connecte-toi, sélectionne ton app, demande un nouveau "Page Access Token" avec les permissions pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish.
3. Copie-le et colle-le dans les secrets de ton app GrowIQ (clé : META_ACCESS_TOKEN).

Raison technique : ${status.error}

— GrowIQ`;
  } else if (status.daysRemaining !== null && status.daysRemaining <= REMINDER_THRESHOLD_DAYS) {
    subject = `⏰ Ton code d'accès Meta expire dans ${status.daysRemaining} jour${status.daysRemaining > 1 ? "s" : ""}`;
    body = `Bonjour,

Petit rappel amical : ton code d'accès Facebook / Instagram expire dans ${status.daysRemaining} jour${status.daysRemaining > 1 ? "s" : ""} (le ${status.expiresAt?.toLocaleDateString("fr-FR") ?? "?"}).

Sans renouvellement, GrowIQ ne pourra plus publier tes posts automatiquement après cette date.

Comment renouveler (5 minutes) :
1. Va sur https://developers.facebook.com/tools/explorer/
2. Connecte-toi, sélectionne ton app, demande un nouveau "Page Access Token" avec les permissions pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish.
3. Copie-le et colle-le dans les secrets de ton app GrowIQ (clé : META_ACCESS_TOKEN).

— GrowIQ`;
  }

  if (subject && body) {
    const to = await getReminderRecipient();
    if (!to) {
      logger.warn(
        { daysRemaining: status.valid ? status.daysRemaining : null },
        "Meta token reminder needed but no notification email on file",
      );
      return;
    }
    // Durable per-day-per-reason marker so a restart can't trigger a duplicate.
    const reasonKey = !status.valid ? "expired" : `expiring-${status.daysRemaining}`;
    const firstTime = await claimSystemEvent(`meta-token-reminder-${today}-${reasonKey}`);
    if (!firstTime) return;
    const result = await sendEmail({ to: [to], subject, body });
    if (result.success) {
      logger.info({ to, daysRemaining: status.valid ? status.daysRemaining : null }, "Meta token reminder sent");
    } else {
      logger.warn({ err: result.error }, "Failed to send Meta token reminder");
    }
  }
}

if (process.env.NODE_ENV !== "test") {
  let tickCount = 0;
  setInterval(() => {
    tickCount += 1;
    void processScheduledPosts();
    void checkMetaTokenHealth();
    // Every ~5 minutes, run the safety-net recap sweep for any campaigns
    // whose recap was missed by the tick-level trigger.
    if (tickCount % 5 === 0) void sweepCampaignRecaps();
  }, 60_000);
}

// ════════════════════════════════════════════════════════════════════════════
// AGENCY — automatic marketing agency workflow
// ════════════════════════════════════════════════════════════════════════════

const AGENCY_PLAN_PROMPT = `Tu es un conseiller marketing qui parle à une personne qui n'y connaît RIEN (imagine une grand-mère de 70 ans qui veut lancer un truc).

RÈGLES DE LANGAGE (impératives) :
- Zéro jargon. JAMAIS de mots comme : CPC, CTR, CPM, ROI, conversion, audience, ciblage, impressions, organique, payant, engagement, reach.
- Remplace par des mots simples :
  • "personnes qui verront ton message" au lieu de "impressions"
  • "personnes qui cliqueront" au lieu de "clics"
  • "personnes qui pourraient acheter" au lieu de "conversions"
  • "les gens qu'on veut toucher" au lieu de "audience cible"
  • "comment on les trouvera" au lieu de "stratégie de ciblage"
- Tutoiement chaleureux. Phrases courtes. Emojis bienvenus pour rassurer.

Tu produis UN SEUL objet JSON valide (sans markdown, sans texte autour) :
{
  "audienceSummary": "1-2 phrases qui décrivent les gens qu'on va toucher, en langage simple",
  "targetingNarrative": "1-2 phrases : comment on va les trouver, sans jargon",
  "budgetNarrative": "1-2 phrases : pour cette campagne on utilise uniquement des publications gratuites sur les réseaux sociaux ; on explique pourquoi c'est suffisant pour commencer",
  "estimatedResults": {
    "impressions": "fourchette en personnes (ex: 'entre 2 000 et 5 000 personnes verront ton message')",
    "clicks": "fourchette (ex: 'entre 80 et 200 personnes cliqueront')",
    "conversions": "fourchette (ex: 'entre 5 et 15 personnes pourraient acheter')"
  },
  "posts": [
    {
      "id": "p1",
      "channel": "facebook" ou "instagram",
      "scheduledFor": "ISO-8601 datetime dans les 7 prochains jours, JAMAIS dans le passé",
      "copy": "texte du message (200-400 caractères, ton adapté au réseau, 1-2 emojis pertinents et 2-4 hashtags si Instagram)",
      "imagePrompt": "description ANGLAISE détaillée pour générer un visuel carré professionnel (photo réaliste, pas de texte sur l'image)"
    }
  ],
  "recommendations": ["3 à 5 astuces TRÈS courtes et concrètes, sans jargon"],
  "decisions": [
    { "what": "phrase ultra-courte de la décision (ex: 'J'ai choisi Instagram')", "why": "phrase simple qui explique pourquoi, comme à un enfant" }
  ]
}

RÈGLES MÉTIER :
- TOI tu choisis le ou les réseaux (Facebook et/ou Instagram) en fonction du produit et des gens à toucher. Explique ton choix dans "decisions".
- TOI tu choisis les heures de publication (FB: 11h-14h, IG: 18h-21h, heure de Paris). Explique pourquoi dans "decisions".
- Génère exactement 5 messages étalés entre demain et J+7.
- "decisions" doit contenir 3 à 5 entrées qui expliquent : (1) le choix du/des réseau(x), (2) le choix des horaires, (3) le ton choisi pour les messages, (4) la fréquence de publication, (5) éventuellement le style des visuels.
- Réponds UNIQUEMENT avec le JSON.`;

function buildAgencyUserPrompt(brief: AgencyBrief): string {
  const channelsLine =
    brief.channels.length > 0
      ? `- Réseaux suggérés par la personne : ${brief.channels.join(", ")} (mais tu peux décider mieux)`
      : `- Réseaux : à toi de choisir entre Facebook et/ou Instagram, en fonction du contexte.`;
  return `Brief :
- Ce que la personne propose : ${brief.product}
- Les gens qu'elle veut toucher : ${brief.audience}
- Son but : ${brief.objective}
- Budget : ${brief.budget || "non précisé, on part sur du gratuit"}
${channelsLine}

Date d'aujourd'hui : ${new Date().toISOString()}

Produis le plan JSON.`;
}

function clampFutureDate(iso: string, fallbackOffsetHours: number): string {
  const d = new Date(iso);
  const now = Date.now();
  if (isNaN(d.getTime()) || d.getTime() < now + 30 * 60_000) {
    return new Date(now + fallbackOffsetHours * 3_600_000).toISOString();
  }
  return d.toISOString();
}

// Simple in-memory rate limit for the expensive /agency/generate endpoint.
// Single-tenant app, no auth — protect against accidental loops or external abuse.
const agencyGenHits = new Map<string, number[]>();
const AGENCY_GEN_WINDOW_MS = 60 * 60_000; // 1h window
const AGENCY_GEN_MAX = 10; // max 10 per hour per IP

function checkAgencyRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (agencyGenHits.get(ip) ?? []).filter((t) => now - t < AGENCY_GEN_WINDOW_MS);
  if (hits.length >= AGENCY_GEN_MAX) return false;
  hits.push(now);
  agencyGenHits.set(ip, hits);
  return true;
}

function cap(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

function normalizePlan(raw: unknown): AgencyPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const er = (r["estimatedResults"] ?? {}) as Record<string, unknown>;
  const posts = Array.isArray(r["posts"]) ? r["posts"] : [];
  const recommendations = Array.isArray(r["recommendations"])
    ? (r["recommendations"] as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];
  const decisionsRaw = Array.isArray(r["decisions"]) ? r["decisions"] : [];
  const decisions: AgencyDecision[] = decisionsRaw
    .slice(0, 8)
    .map((d) => {
      const o = (d ?? {}) as Record<string, unknown>;
      return { what: cap(o["what"], 200), why: cap(o["why"], 400) };
    })
    .filter((d) => d.what && d.why);
  return {
    audienceSummary: cap(r["audienceSummary"], 500) || "À préciser.",
    targetingNarrative: cap(r["targetingNarrative"], 800) || "—",
    budgetNarrative: cap(r["budgetNarrative"], 800) || "—",
    estimatedResults: {
      impressions: cap(er["impressions"], 200) || "—",
      clicks: cap(er["clicks"], 200) || "—",
      conversions: cap(er["conversions"], 200) || "—",
    },
    posts: posts.slice(0, 6).map((p, idx): AgencyPlannedPost => {
      const po = (p ?? {}) as Record<string, unknown>;
      const ch = po["channel"] === "instagram" ? "instagram" : "facebook";
      return {
        id: cap(po["id"], 20) || `p${idx + 1}`,
        channel: ch,
        scheduledFor: clampFutureDate(cap(po["scheduledFor"], 50), (idx + 1) * 24),
        copy: cap(po["copy"], 1200) || "(message manquant)",
        imagePrompt: cap(po["imagePrompt"], 800) || "Professional marketing photo, modern style",
      };
    }),
    recommendations,
    decisions,
  };
}

router.post("/agency/generate", async (req, res): Promise<void> => {
  // Agency currently publishes only on Facebook/Instagram via global admin
  // credentials. Until per-user Meta OAuth (or LinkedIn-only agency mode) ships,
  // we must not let non-admins generate or launch campaigns — otherwise their
  // posts would publish on the admin's own pages.
  const isAdmin = (req as unknown as { isAdmin?: boolean }).isAdmin === true;
  if (!isAdmin) {
    res.status(403).json({
      error:
        "L'Agence automatique publie sur Facebook/Instagram et n'est pas encore disponible sur ton compte. En attendant, utilise le chat pour créer et publier sur LinkedIn.",
      code: "agency_admin_only",
    });
    return;
  }
  const rateKey = uid(req) + ":generate";
  if (!checkAgencyRateLimit(rateKey)) {
    res.status(429).json({
      error: "Trop de générations récentes. Réessayez dans une heure (limite : 10/h).",
    });
    return;
  }

  const brief = req.body as Partial<AgencyBrief>;
  if (!brief?.product || !brief?.audience || !brief?.objective) {
    res.status(400).json({ error: "Réponds aux 3 questions avant de continuer." });
    return;
  }

  const channelsArr = Array.isArray(brief.channels) ? brief.channels : [];
  const allowedChannels = channelsArr.filter(
    (c): c is "facebook" | "instagram" => c === "facebook" || c === "instagram"
  );
  // Empty = agent decides (this is the new default for the simplified flow).

  const cleanBrief: AgencyBrief = {
    product: cap(brief.product, 500),
    audience: cap(brief.audience, 500),
    budget: cap(brief.budget, 100) || "petit budget pour commencer",
    objective: cap(brief.objective, 50),
    channels: allowedChannels,
  };
  if (!cleanBrief.product || !cleanBrief.audience || !cleanBrief.objective) {
    res.status(400).json({ error: "Une des réponses est vide." });
    return;
  }

  let plan: AgencyPlan;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AGENCY_PLAN_PROMPT + (await getBusinessContextPrompt(uid(req))) },
        { role: "user", content: buildAgencyUserPrompt(cleanBrief) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    plan = normalizePlan(JSON.parse(raw));
  } catch (err) {
    req.log.error({ err }, "Agency plan generation failed");
    res.status(500).json({ error: "Échec de la génération du plan. Réessayez." });
    return;
  }

  if (plan.posts.length === 0) {
    res.status(500).json({ error: "Plan généré invalide (aucun post)." });
    return;
  }

  const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
  const imageResults = await Promise.allSettled(
    plan.posts.map(async (p) => {
      const buf = await generateImageBuffer(p.imagePrompt, "1024x1024");
      const uploaded = await uploadPublicBuffer(buf, { ext: "png", contentType: "image/png" });
      return uploaded.publicUrl;
    })
  );
  plan.posts = plan.posts.map((p, i) => {
    const r = imageResults[i];
    return { ...p, imageUrl: r.status === "fulfilled" ? r.value : undefined };
  });

  const [created] = await db
    .insert(agencyCampaigns)
    .values({
      name: cleanBrief.product.slice(0, 80),
      status: "draft",
      brief: cleanBrief,
      plan,
      userId: uid(req),
    })
    .returning();

  res.status(201).json(created);
});

router.post("/agency/:id/launch", async (req, res): Promise<void> => {
  // Same guard as /agency/generate: launching schedules FB/IG posts that would
  // hit the admin's pages with the global Meta token.
  const isAdmin = (req as unknown as { isAdmin?: boolean }).isAdmin === true;
  if (!isAdmin) {
    res.status(403).json({
      error:
        "Le lancement de campagne Facebook/Instagram n'est pas disponible sur ton compte. Utilise le chat pour publier sur LinkedIn.",
      code: "agency_admin_only",
    });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  const { notificationEmail, plan: editedPlan } = req.body as {
    notificationEmail?: string;
    plan?: AgencyPlan;
  };

  const [campaign] = await db
    .select()
    .from(agencyCampaigns)
    .where(and(eq(agencyCampaigns.id, id), eq(agencyCampaigns.userId, uid(req))));
  if (!campaign) {
    res.status(404).json({ error: "Campagne introuvable" });
    return;
  }
  if (campaign.status === "launched") {
    res.status(409).json({ error: "Cette campagne a déjà été lancée." });
    return;
  }

  // Normalize incoming edited plan (defensive: client could send anything).
  const finalPlan: AgencyPlan = editedPlan
    ? { ...normalizePlan(editedPlan), recommendations: campaign.plan.recommendations }
    : campaign.plan;
  // Preserve original imageUrls (client never receives them changed, but be safe).
  finalPlan.posts = finalPlan.posts.map((p, i) => ({
    ...p,
    imageUrl: p.imageUrl ?? campaign.plan.posts[i]?.imageUrl,
  }));

  if (finalPlan.posts.length === 0) {
    res.status(400).json({ error: "Aucun post à programmer." });
    return;
  }

  // Double-check côté serveur : l'utilisateur doit avoir au moins un canal
  // de diffusion connecté pour chaque type de post qu'on s'apprête à programmer.
  // Évite que le worker tente de publier sur une page non liée (rejet silencieux).
  const channelsUsed = new Set(finalPlan.posts.map((p) => p.channel));
  const channelsMissing: string[] = [];
  if (channelsUsed.has("facebook") && !isMetaConfigured("facebook")) channelsMissing.push("Facebook");
  if (channelsUsed.has("instagram") && !isMetaConfigured("instagram")) channelsMissing.push("Instagram");
  if (channelsMissing.length > 0) {
    res.status(400).json({
      error: `Aucun canal de diffusion connecté pour : ${channelsMissing.join(", ")}. Va dans ton profil et connecte ces comptes avant de lancer.`,
      code: "no_connected_channel",
      missing: channelsMissing,
    });
    return;
  }

  // Atomic launch: claim the campaign first via conditional update (prevents double-launch race),
  // then create all scheduled posts inside a transaction (rolls back if any insert fails).
  const claimed = await db
    .update(agencyCampaigns)
    .set({ status: "launching" })
    .where(and(
      eq(agencyCampaigns.id, id),
      eq(agencyCampaigns.status, "draft"),
      eq(agencyCampaigns.userId, uid(req)),
    ))
    .returning();
  if (claimed.length === 0) {
    res.status(409).json({ error: "Campagne déjà en cours de lancement ou lancée." });
    return;
  }

  let createdIds: number[] = [];
  try {
    createdIds = await db.transaction(async (tx) => {
      const ids: number[] = [];
      for (const post of finalPlan.posts) {
        const postMeta: Record<string, unknown> = {
          campaignName: campaign.name,
          campaignId: campaign.id,
        };
        if (post.imageUrl) postMeta.imageUrl = post.imageUrl;
        if (notificationEmail) postMeta.notificationEmail = notificationEmail;
        const [sp] = await tx
          .insert(scheduledPosts)
          .values({
            title: `${campaign.name} — ${post.channel}`,
            content: post.copy,
            platform: post.channel,
            scheduledFor: new Date(post.scheduledFor),
            meta: postMeta,
            status: "pending",
            userId: uid(req),
          })
          .returning();
        ids.push(sp.id);
        post.scheduledPostId = sp.id;
      }
      await tx
        .update(agencyCampaigns)
        .set({
          status: "launched",
          plan: finalPlan,
          notificationEmail: notificationEmail ?? null,
          launchedAt: new Date(),
        })
        .where(eq(agencyCampaigns.id, id));
      return ids;
    });
  } catch (err) {
    req.log.error({ err }, "Launch transaction failed, reverting to draft");
    await db
      .update(agencyCampaigns)
      .set({ status: "draft" })
      .where(eq(agencyCampaigns.id, id));
    res.status(500).json({ error: "Échec du lancement. Réessayez." });
    return;
  }

  let emailStatus: { sent: boolean; error?: string; provider?: string } = { sent: false };
  if (notificationEmail) {
    try {
      const lines = finalPlan.posts
        .map(
          (p) =>
            `• ${new Date(p.scheduledFor).toLocaleString("fr-FR")} — ${p.channel === "facebook" ? "Facebook" : "Instagram"} : ${p.copy.slice(0, 120)}…`
        )
        .join("\n");
      const result = await sendEmail({
        to: [notificationEmail],
        subject: `Ta campagne "${campaign.name}" est lancée 🚀`,
        body: `Bonjour,

Ta campagne vient d'être lancée. Voici ce qui va partir tout seul dans les prochains jours :

${lines}

Pour qui on travaille : ${finalPlan.audienceSummary}

Ce que ça pourrait donner :
- ${finalPlan.estimatedResults.impressions}
- ${finalPlan.estimatedResults.clicks}
- ${finalPlan.estimatedResults.conversions}

Tu peux revenir voir tes campagnes à tout moment dans l'application.

— Ton assistant marketing`,
      });
      emailStatus = { sent: result.success, error: result.error, provider: result.provider };
      if (result.success) {
        req.log.info({ provider: result.provider, from: result.from, to: notificationEmail }, "Recap email sent");
      } else {
        req.log.warn({ provider: result.provider, error: result.error }, "Recap email failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emailStatus = { sent: false, error: msg };
      req.log.warn({ err }, "Recap email threw");
    }
  }

  const [refreshed] = await db
    .select()
    .from(agencyCampaigns)
    .where(eq(agencyCampaigns.id, id));
  res.json({ campaign: refreshed, scheduledPostIds: createdIds, emailStatus });
});

router.get("/agency", async (req, res) => {
  const list = await db
    .select()
    .from(agencyCampaigns)
    .where(eq(agencyCampaigns.userId, uid(req)))
    .orderBy(desc(agencyCampaigns.createdAt));
  res.json(list);
});

router.get("/agency/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  const [campaign] = await db
    .select()
    .from(agencyCampaigns)
    .where(and(eq(agencyCampaigns.id, id), eq(agencyCampaigns.userId, uid(req))));
  if (!campaign) {
    res.status(404).json({ error: "introuvable" });
    return;
  }
  const postIds = (campaign.plan.posts ?? [])
    .map((p) => p.scheduledPostId)
    .filter((x): x is number => typeof x === "number");
  let scheduled: typeof scheduledPosts.$inferSelect[] = [];
  if (postIds.length > 0) {
    scheduled = await db
      .select()
      .from(scheduledPosts)
      .where(and(
        eq(scheduledPosts.userId, uid(req)),
        inArray(scheduledPosts.id, postIds),
      ));
  }
  res.json({ campaign, scheduledPosts: scheduled });
});

router.delete("/agency/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id invalide" });
    return;
  }
  await db
    .delete(agencyCampaigns)
    .where(and(eq(agencyCampaigns.id, id), eq(agencyCampaigns.userId, uid(req))));
  res.status(204).end();
});

export default router;
