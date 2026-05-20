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
- `artifacts/api-server/src/routes/openai/index.ts` — All chat/AI routes
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

## User preferences

- **Communication** : en français, pas d'emojis sauf demande explicite, vulgarisation pour utilisateur non-technique
- **Style code review** : signaler proactivement les compromis et limites techniques avant de coder

## Rappels actifs

- **📅 Lundi 25 mai 2026** — L'utilisateur veut passer à l'**Option A** (intégration Buffer/Hootsuite/Publer) pour permettre à l'agent IA de publier directement sur ses comptes sociaux (Instagram, Facebook, LinkedIn, X, TikTok). Plan : demander quel SaaS il a choisi (Buffer recommandé, ~10€/mois), récupérer son token API, et coder l'intégration dans le scheduler worker (~1h de travail). Dès que vous voyez cette note, relancez-le.

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- SSE endpoints cannot use generated React Query hooks — use raw fetch
- `response.data` from gpt-image-1 may be undefined — always use optional chaining

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
