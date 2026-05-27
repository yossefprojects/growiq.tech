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
- AI: OpenAI gpt-5.4 via Replit AI Integrations (no API key needed)
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
- `lib/db/src/schema/email-contacts.ts`, `email-campaigns.ts`, `email-events.ts` — Emailing (contacts, campagnes IA, events Resend avec idempotency)
- `artifacts/api-server/src/routes/email.ts` — CRUD contacts + génération IA + envoi Resend (atomic status transition, retry-safe)
- `artifacts/api-server/src/routes/webhooks.ts` — Webhook Resend (raw body + signature Svix + onConflictDoNothing)
- `artifacts/marketing-agent/src/pages/emails.tsx` — Page Emails (contacts + campagnes avec stats opens/clicks)
- `artifacts/marketing-agent/src/lib/sanitize-html.ts` — DOMPurify wrapper pour HTML email (allowlist tags/attrs)
- `artifacts/marketing-agent/src/` — Frontend React app
- `lib/integrations-openai-ai-server/` — OpenAI server SDK wrapper

## Architecture decisions

- SSE streaming for chat responses (token-by-token) using raw fetch + ReadableStream on the client
- Conversation history is persisted in PostgreSQL and sent to OpenAI on each request for context
- The marketing system prompt is hardcoded in the API route for consistency
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

## Multi-tenant — règles de gating admin

Meta (FB/IG) et les Ads (Meta + Google) utilisent des **identifiants globaux dans les env secrets** (le compte admin GrowIQ). Ils ne sont PAS par-utilisateur. Tout endpoint qui les touche doit être gated `isAdmin`:

- `/api/openai/meta/status` → renvoie `{facebook:false, instagram:false}` pour non-admins
- `/api/openai/meta/profile` → 404 pour non-admins (sinon fuite identité page admin)
- `/api/openai/meta/publish` → 403 pour non-admins
- `/api/openai/agency/generate` + `/agency/:id/launch` → 403 (génère uniquement FB/IG aujourd'hui)
- `/api/ads/*` → middleware global qui bloque tous les non-admins (sinon ils dépenseraient le budget admin)
- Worker `processScheduledPosts` → JOIN `localUsers.isAdmin` avant d'appeler `publishToMeta`, marque `failed` sinon

**LinkedIn est OK** : OAuth par-utilisateur, tokens stockés par `userId`. Idem chat / conversations / business profile / scheduled posts non-Meta.

Si on ajoute une nouvelle route qui appelle `publishToMeta`, `*MetaAds*`, ou `*GoogleAds*` → ajouter le gate `isAdmin`.

## Emailing — fonctionnement

- **Par-utilisateur** : contacts, campagnes, events scopés par `userId` (pas admin-only).
- **Tunnel agency** : path `email` génère un email IA → preview éditable → sélecteur destinataires (contacts ou tag ou tous abonnés) → envoi Resend.
- **Page dédiée** : `/app/emails` pour CRUD contacts (ajout, import CSV, suppression) + liste campagnes avec stats live.
- **Anti double-envoi** : route `/send` fait une transition atomique `draft|partially_failed → sending` via `UPDATE ... WHERE status IN (...) RETURNING`. Try/finally garantit statut terminal (`sent`/`failed`/`partially_failed`).
- **Retry** : sur `partially_failed`, exclut les contacts déjà reçus avec succès (event `sent` présent).
- **Webhook Resend** : `POST /api/webhooks/resend` vérifie signature Svix sur **bytes bruts** (`express.raw` monté avant `express.json` sur cette route). Idempotency via unique index sur `(resend_message_id, type)` + `onConflictDoNothing`. Compteurs `openCount`/`clickCount` incrémentés UNIQUEMENT si l'insert n'a pas été dédupliqué.
- **Secret requis pour activer le tracking** : `RESEND_WEBHOOK_SECRET` (sinon `/webhooks/resend` renvoie 503). Sans ce secret, l'envoi marche mais pas les events ouvertures/clics.
- **HTML email** : preview rendue avec `dangerouslySetInnerHTML` après passage par `sanitizeEmailHtml` (DOMPurify, allowlist).

## Rappels actifs

- **Phase 2 en cours d'activation** : code backend prêt (`artifacts/api-server/src/lib/meta-ads.ts`, `google-ads.ts`, routes `/api/ads/*`, table `ad_campaigns`). En attente des validations admin :
  - Google Ads : developer token Basic Access **demandé** (dossier `2-7523000040163`, 2-6 semaines de validation Google) → secrets à ajouter : `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optionnel MCC).
  - Meta Ads : Business Manager + permission `ads_management` + App Review → secret à ajouter : `META_AD_ACCOUNT_ID` (format `act_xxxxxxxxxx`). Le `META_ACCESS_TOKEN` actuel doit être régénéré avec le scope `ads_management` après l'approbation.
  - Vérifier le statut : `GET /api/ads/status` retourne `{meta:{configured, missing[]}, google:{configured, missing[]}}`.
- **Phase 1.5** (rapide quand demandé) : rapport hebdo automatique avec Meta Insights API (besoin permission `pages_read_engagement` sur le token) pour vues/likes/partages organiques.

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- SSE endpoints cannot use generated React Query hooks — use raw fetch
- `response.data` from gpt-image-1 may be undefined — always use optional chaining

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
