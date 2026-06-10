# Agent Marketing IA

Un agent AI spécialisé en marketing avec une interface de chat web et une API. L'agent répond en français et couvre tous les domaines du marketing : digital (SEO, inbound/outbound), traditionnel, relationnel et d'influence.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/marketing-agent run dev` — run the frontend (port 22821)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-provisioned by Replit AI Integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI chat (Jarvis, expert pub Meta/Google Ads): Anthropic Claude `claude-opus-4-8` via Replit AI Integrations
- AI génération (campagnes, agency, analyze-url, images): OpenAI gpt-5.4 / gpt-image-1 via Replit AI Integrations (no API key needed)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/conversations.ts` — Conversations table
- `lib/db/src/schema/messages.ts` — Messages table
- `artifacts/api-server/src/routes/openai/index.ts` — All chat/AI routes + agency workflow (`/agency/generate`, `/agency/:id/launch`, `/agency`)
- `artifacts/api-server/src/lib/objectStorage.ts` — GCS public bucket helpers (upload + serve)
- `artifacts/api-server/src/lib/meta-ads.ts` — Meta Marketing API (boost de posts FB payants)
- `artifacts/api-server/src/lib/google-ads.ts` — Google Ads REST API (campagnes Search)
- `artifacts/api-server/src/routes/ads.ts` — Endpoints `/api/ads/*` (status, boost, activate/pause, métriques)
- `lib/db/src/schema/ad-campaigns.ts` — Suivi des campagnes payantes lancées
- `artifacts/marketing-agent/src/pages/agency.tsx` — Agence automatique multi-step UI
- `lib/db/src/schema/agency-campaigns.ts` — Agency campaigns table (brief + plan jsonb)
- `lib/db/src/schema/email-contacts.ts`, `email-campaigns.ts`, `email-events.ts`, `email-contact-folders.ts` — Emailing (contacts, dossiers, campagnes IA, events Resend avec idempotency)
- `artifacts/api-server/src/routes/email.ts` — CRUD contacts + génération IA + envoi Resend (atomic status transition, retry-safe)
- `artifacts/api-server/src/routes/webhooks.ts` — Webhook Resend (raw body + signature Svix + onConflictDoNothing)
- `artifacts/marketing-agent/src/pages/emails.tsx` — Page Emails (contacts + campagnes avec stats opens/clicks)
- `artifacts/marketing-agent/src/lib/sanitize-html.ts` — DOMPurify wrapper pour HTML email (allowlist tags/attrs)
- `artifacts/marketing-agent/src/` — Frontend React app
- `lib/integrations-openai-ai-server/` — OpenAI server SDK wrapper

## Architecture decisions

- SSE streaming for chat responses (token-by-token) using raw fetch + ReadableStream on the client
- **Chat principal = "Jarvis"** (Anthropic Claude `claude-opus-4-8`) : expert publicité Meta/Google Ads, pose 5 questions une par une (plateforme → objectif → budget → audience → annonce) puis génère un plan structuré. Prompt `JARVIS_SYSTEM_PROMPT` dans `routes/openai/index.ts`. Le système est un param top-level Anthropic (pas un message). Stream filtré sur `content_block_delta`/`text_delta`. Le wire SSE est identique (`data:{content}` + `data:{done:true}`) donc le client `chat.tsx` est inchangé. Stream wrappé try/catch/finally + `req.on("close")` → `stream.abort()`.
- Les autres flux IA (campaigns/generate, analyze-url, agency, images, email) restent sur OpenAI + `MARKETING_SYSTEM_PROMPT`.
- Conversation history is persisted in PostgreSQL and sent to the model on each request for context
- Orval-generated hooks used for all CRUD operations; SSE endpoint uses raw fetch
- AI API keys auto-provisioned via Replit AI Integrations (no user API key required)

## Product

- Chat interface with conversation sidebar (create, list, delete conversations)
- Real-time streaming responses from a marketing expert AI
- Full conversation history persistence
- REST API for integration with other tools
- **Agence automatique** (`/app/agency`) : brief 3 questions (produit / cible / objectif via 3 gros boutons) → IA choisit les réseaux et horaires → preview éditable avec mode "Explique-moi" → bouton "Lancer" → publication automatique FB/IG + email récap. UI conçue pour utilisateur non-technique (mamie 70 ans), zéro jargon, ton tutoiement chaleureux avec emojis.
- Auto-image generation for any scheduled FB/IG post (via Object Storage public bucket)

## User preferences

- **Communication** : en français, pas d'emojis sauf demande explicite, vulgarisation pour utilisateur non-technique
- **Style code review** : signaler proactivement les compromis et limites techniques avant de coder
- **Pre-publish check obligatoire** : avant chaque déploiement (ou avant de proposer `suggest_deploy`), systématiquement (1) `pnpm run typecheck` + `pnpm --filter @workspace/marketing-agent run build` pour valider le bundle Vite, (2) screenshot de la home `/` et de `/app` (ou login) via le tool screenshot pour vérifier qu'il n'y a pas d'écran blanc / d'erreur JS bloquante côté client. Ne jamais skip ce check même pour des "petits" changements UI — c'est ce qui a causé l'incident `Megaphone is not defined` en prod.

## Multi-tenant — OAuth per-user

Depuis la refonte multi-tenant, chaque user connecte SES propres comptes via `/app/integrations` :

- **Facebook + Instagram** : OAuth Meta unique → token long-lived 60j stocké dans `user_integrations` (platform="meta"). Metadata jsonb contient `facebookPages[]`, `instagramAccount`, `selectedFacebookPageId`. MVP : on prend la 1ère page FB (pas de sélecteur multi-pages). IG = compte business lié à la page FB.
- **LinkedIn** : OAuth existant, table dédiée `linkedin_connections` (conservée pour compatibilité).
- **Resend** : clé API perso + domaine d'envoi → stocké dans `user_integrations` (platform="resend"). Si pas de clé perso : freemium 100 emails/mois via clé admin partagée (`email_usage` (userId, year, month)).
- **Google Ads** : placeholder UI "bientôt", en attente du developer token Basic Access côté admin.

Helpers backend :
- `lib/user-integrations.ts` : `upsertUserIntegration/getUserIntegration/deleteUserIntegration/markIntegrationStatus`
- `lib/meta-user.ts` : `publishToMetaForUser({userId, platform, message, imageUrl})` — marque le token `expired` automatiquement sur codes erreur Meta 190/102/463.
- `lib/facebook-oauth.ts` : state CSRF signé HMAC via `SESSION_SECRET` + nonce single-use 10min, scopes `pages_manage_posts/instagram_content_publish/...`, échange code → long-lived token + fetch pages avec `ig_business_account`.
- `lib/email.ts` : option `{userId}` → ordre de résolution : clé Resend perso → quota admin freemium (avec `reserveEmailsFromQuota` atomique + `refundEmailsToQuota` en cas d'échec) → fallback env. Sans userId = envoi système (notifications admin).
- `lib/email-usage.ts` : `reserveEmailsFromQuota(userId, count)` atomique avec UPSERT contraint sur quota. Reset implicite chaque mois (clé (year, month)).

Routes per-user (toutes authed, **pas admin-only**) :
- `GET /api/integrations` → statut agrégé `{facebook, instagram, linkedin, resend, googleAds}`
- `GET /api/integrations/email-usage` → `{usingOwnKey, used, quota, remaining}`
- `POST /api/integrations/resend` (apiKey re_*, fromEmail, fromName?) + `/test`
- `DELETE /api/integrations/:platform` (meta | linkedin | resend | google_ads)
- `GET /api/auth/facebook/start` (authed) → URL OAuth
- `GET /api/auth/facebook/callback` (PUBLIC — callback OAuth)
- `GET /api/facebook/status`, `POST /api/facebook/disconnect`

Worker `processScheduledPosts` :
- FB/IG : si `post.userId` non-null → `publishToMetaForUser` (fatal sur notConnected/tokenExpired/missingInstagram, pas de retry). Si NULL (legacy pre-auth) → fallback admin `publishToMeta`.
- Email : `sendEmail({userId: post.userId})` → clé perso ou quota freemium.

**Tradeoffs signalés** :
- Tokens stockés en clair (cohérent avec `linkedin_connections` existant) → à chiffrer at-rest dans une migration ultérieure groupée.
- Pas de refresh token Meta auto → l'user reconnecte à expiration via notification.
- Pas de webhook Meta deauthorize/permission_revoked (à brancher en suivi — pour l'instant on détecte l'expiration à la publication suivante).

## Admin-only — règles de gating (anciens flows globaux)

Meta (FB/IG) et les Ads (Meta + Google) utilisent des **identifiants globaux dans les env secrets** (le compte admin GrowIQ). Ils ne sont PAS par-utilisateur. Tout endpoint qui les touche doit être gated `isAdmin`:

- `/api/openai/meta/status` → renvoie `{facebook:false, instagram:false}` pour non-admins
- `/api/openai/meta/profile` → 404 pour non-admins (sinon fuite identité page admin)
- `/api/openai/meta/publish` → 403 pour non-admins
- `/api/openai/agency/generate` + `/agency/:id/launch` → 403 (génère uniquement FB/IG aujourd'hui)
- `/api/ads/*` → middleware global qui bloque tous les non-admins (sinon ils dépenseraient le budget admin)
- Worker `processScheduledPosts` → JOIN `localUsers.isAdmin` avant d'appeler `publishToMeta`, marque `failed` sinon

**LinkedIn est OK** : OAuth par-utilisateur, tokens stockés par `userId`. Idem chat / conversations / business profile / scheduled posts non-Meta. Le worker `processScheduledPosts` publie automatiquement les posts LinkedIn programmés via `publishLinkedinPost({userId: post.userId, ...})` — pas de gating admin (chacun publie sur son propre compte). Refus si `post.userId` est null (legacy) ou si la connexion LinkedIn manque/a expiré.

Si on ajoute une nouvelle route qui appelle `publishToMeta`, `*MetaAds*`, ou `*GoogleAds*` → ajouter le gate `isAdmin`.

## Emailing — fonctionnement

- **Par-utilisateur** : contacts, campagnes, events scopés par `userId` (pas admin-only).
- **Tunnel agency** : path `email` génère un email IA → preview éditable → sélecteur destinataires (contacts ou tag ou tous abonnés) → envoi Resend.
- **Style d'écriture** : à l'étape objectif (flux email), choix Vouvoiement / Tutoiement. **Défaut = vouvoiement** (registre pro). Le champ `style` (`vouvoiement|tutoiement`) est envoyé à `/email/campaigns/generate`, injecté dans le prompt via `styleInstruction()` et persisté dans `email_campaigns.brief.style`. Sans sélection → vouvoiement côté serveur (`?? "vouvoiement"`). L'ancien défaut tutoiement a été retiré.
- **Page dédiée** : `/app/emails` pour CRUD contacts (ajout, import CSV, suppression) + liste campagnes avec stats live.
- **Dossiers (listes de contacts)** : table `email_folders` (id, userId, name, unique(userId,name)) + colonne nullable `email_contacts.folderId` (1 dossier max par contact, null = "Sans dossier"). Pensé pour user non-tech : créer/renommer/supprimer un dossier (ex. "PDV Intermarché"), importer une liste CSV DANS un dossier, et envoyer une campagne à TOUT un dossier. Routes : `GET /email/folders` (avec `contactCount` par dossier + `noFolderCount`), `POST/PATCH/DELETE /email/folders/:id`. `GET /email/contacts?folderId=<id>|none` filtre par dossier. Bulk import accepte `folderId` : si fourni → `onConflictDoUpdate` (réaffecte le dossier même aux contacts déjà existants, pour que toute la liste importée se retrouve dans le dossier) ; sinon `onConflictDoNothing`. Send accepte `folderId` (filtre les abonnés du dossier). Supprimer un dossier ne supprime PAS les contacts : ils repassent `folderId = null`. Toutes les routes scopées `userId` + `folderBelongsToUser()` valide l'appartenance avant write. UI : `emails.tsx` ContactsTab (chips de dossiers + créer/renommer/supprimer, ajout/import dans le dossier sélectionné), `agency.tsx` EmailPreviewScreen (sélecteur "Envoyer à un dossier précis").
- **Anti double-envoi** : route `/send` fait une transition atomique `draft|partially_failed → sending` via `UPDATE ... WHERE status IN (...) RETURNING`. Try/finally garantit statut terminal (`sent`/`failed`/`partially_failed`).
- **Retry** : sur `partially_failed`, exclut les contacts déjà reçus avec succès (event `sent` présent).
- **Webhook Resend** : `POST /api/webhooks/resend` vérifie signature Svix sur **bytes bruts** (`express.raw` monté avant `express.json` sur cette route). Idempotency via unique index sur `(resend_message_id, type)` + `onConflictDoNothing`. Compteurs `openCount`/`clickCount` incrémentés UNIQUEMENT si l'insert n'a pas été dédupliqué.
- **Suivi ouvertures/clics — per-user webhook** : chaque user a SON compte Resend → SON secret de webhook. Le webhook (`/api/webhooks/resend`) lit le tag `user_id` du payload (non-trusted) pour récupérer `user_integrations.metadata.resendWebhookSecret` et vérifier la signature Svix avec CE secret ; fallback sur l'env `RESEND_WEBHOOK_SECRET` (compte GrowIQ partagé / freemium). L'user colle son Signing Secret (`whsec_*`) via `/app/integrations` (route `POST /api/integrations/resend/webhook`, gardée par "clé Resend déjà connectée"). Statut exposé via `resend.webhookConfigured` dans `/api/integrations`. Sans secret (ni per-user ni env) → `/webhooks/resend` renvoie 503 et aucun event n'est compté.
- **Suppression de campagne** : `DELETE /email/campaigns/:id` refuse (409) les statuts `sent`/`sending`/`partially_failed` (campagne déjà envoyée = conservée dans l'historique). Seuls `draft` et `failed` sont supprimables. Le bouton corbeille est masqué côté UI pour les campagnes envoyées.
- **HTML email** : preview rendue avec `dangerouslySetInnerHTML` après passage par `sanitizeEmailHtml` (DOMPurify, allowlist).
- **Expéditeur ("from")** : `GET /email/sender` renvoie `{usingOwnKey, fromEmail, fromName}`. L'écran d'envoi (EmailPreviewScreen) affiche l'adresse d'envoi active. Pas de champ "from" libre : Resend exige un domaine vérifié. Si freemium (clé partagée GrowIQ) → affiche l'adresse partagée + bandeau/lien vers `/app/integrations` pour connecter son propre domaine.
  - **Expéditeur partagé freemium** : variable d'env `RESEND_SHARED_FROM` (shared, ex. `GrowIQ <contact@growiq.tech>`) — domaine `growiq.tech` vérifié chez Resend. `sendEmail` l'utilise en priorité (`input.from || SHARED_FROM || connector.fromEmail`) pour les envois connector (freemium) + système + env-key, car le from_email du connector Resend est une adresse Gmail que Resend refuse (403 domaine non vérifié). **Sans `RESEND_SHARED_FROM`, l'envoi freemium retombe sur le Gmail du connector et échoue** → toujours garder cette variable définie en prod. `/email/sender` parse cette variable pour afficher l'expéditeur partagé aux users freemium.
- **Édition complète** : en mode "Modifier", le texte saisi régénère `bodyHtml` côté client via `textToSimpleHtml` (échappe `<`/`>`/`&`, paragraphes sur ligne vide). Ce qui est écrit = ce qui est envoyé.
- **Pièces jointes** : `POST /email/campaigns/:id/attachments` (JSON base64, max 3 fichiers / 10 Mo chacun) → bucket public, métadonnées `{filename, path, contentType, size}` dans `email_campaigns.attachments` (jsonb). `DELETE .../attachments/:index`. À l'envoi : téléchargées UNE fois (`downloadPublicObject`) avant la boucle, passées à Resend en base64 `content`. Tradeoff : stockage public (URL aléatoire non devinable, pas d'authz) — à migrer en privé + URL signées si confidentialité requise.

## Rappels actifs

- **Phase 2 en cours d'activation** : code backend prêt (`artifacts/api-server/src/lib/meta-ads.ts`, `google-ads.ts`, routes `/api/ads/*`, table `ad_campaigns`). En attente des validations admin :
  - Google Ads : developer token Basic Access **demandé** (dossier `2-7523000040163`, 2-6 semaines de validation Google) → secrets à ajouter : `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optionnel MCC).
  - Meta Ads : Business Manager + permission `ads_management` + App Review → secret à ajouter : `META_AD_ACCOUNT_ID` (format `act_xxxxxxxxxx`). Le `META_ACCESS_TOKEN` actuel doit être régénéré avec le scope `ads_management` après l'approbation.
  - Vérifier le statut : `GET /api/ads/status` retourne `{meta:{configured, missing[]}, google:{configured, missing[]}}`.
- **Phase 1.5** (rapide quand demandé) : rapport hebdo automatique avec Meta Insights API (besoin permission `pages_read_engagement` sur le token) pour vues/likes/partages organiques.

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- SSE endpoints cannot use generated React Query hooks — use raw fetch
- **Connecteur Resend = proxy uniquement** : `@replit/connectors-sdk` (v0.4.x) n'expose JAMAIS la clé API (`listConnections` ne renvoie pas `settings.api_key`, `expand=settings/credentials` → 400). Envoyer via `connectors.proxy("resend", "/emails", {method, body})` (la clé est injectée côté Replit). `sendEmail` (`lib/email.ts`) décide la dispo connecteur via `listConnections().length > 0` puis `sendViaResendProxy`. `RESEND_API_KEY` env reste un fallback indépendant. Piège : le `listConnections('resend')` de l'outil agent (sandbox, privilégié) EXPOSE la clé — ne pas en déduire que le SDK applicatif le fait. Bug historique : l'ancien code cherchait `settings.api_key` (toujours absent) → "Aucun fournisseur email configuré" en dev ET prod.
- `response.data` from gpt-image-1 may be undefined — always use optional chaining
- **Routers montés sans préfixe** : tous les routers dans `routes/index.ts` sont montés via `router.use(xxxRouter)` SANS path. Donc tout `router.use(middleware)` à l'intérieur d'un router voit TOUTES les requêtes API, pas seulement celles du préfixe sémantique. Toujours filtrer sur `req.path.startsWith("/<prefix>")` dans le middleware. Bug historique : le middleware admin de `routes/ads.ts` interceptait `/auth/facebook/start` et renvoyait `[]` (corrigé 2026-05-28).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
