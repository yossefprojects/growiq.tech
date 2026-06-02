---
name: i18n architecture (FR/EN)
description: How the French/English language switch is built in marketing-agent and how to translate more strings safely.
---

# i18n architecture (marketing-agent)

The app was authored 100% in French. We added a FR/EN switch using a
**source-string-as-key** approach (the French text *is* the lookup key).

- `src/lib/i18n/index.tsx` — `I18nProvider` (wraps app inside QueryClientProvider, needs Clerk `useAuth`), `useI18n()`, `useT()`. `t(fr, vars?)` returns the English value from `dict.ts` when language === "en", else returns the French source unchanged. Missing entry ⇒ falls back to the French source (never blank, never a raw key).
- `src/lib/i18n/dict.ts` — flat `en: Record<string,string>` mapping exact French source → English.
- `src/components/language-switcher.tsx` — FR/EN toggle. Lives in the sidebar AND in the top header of every standalone app page (pages without the sidebar: agency, integrations, account, seo, emails).
- Persistence: `local_users.language` column ("fr" default). API: `GET /api/me` returns `language`; `PATCH /api/me/language {language}`. Client also caches in localStorage `growiq.lang` for instant first paint, then syncs from the server when signed in.

**Why this approach:** wrapping every literal as `t("key")` + maintaining a separate FR resource file would double the churn on a fully-French codebase and risk blank UI on a missed key. Source-as-key means a missed string silently stays French.

**How to translate a page (per wave):**
1. Add `const t = useT();` in each component that renders French text.
2. Wrap visible strings: `Bonjour` → `{t("Bonjour")}`. For interpolation use `{name}` placeholders: `t("Salut {n}", { n })`.
3. Add the exact French → English pair to `dict.ts`.
4. Typecheck. Strings not yet wrapped just remain French — safe to ship partially.

**Gotcha:** the key must match the French source *exactly* (accents, punctuation, emojis, spacing). Copy-paste the source.

**Wave rollout (how it's being done):** translate page-by-page. For big pages, delegate the wrapping to a subagent that edits only its own page file and writes its FR→EN pairs to `.local/i18n-pairs/<page>.json` (do NOT let parallel subagents edit `dict.ts` — conflicts). Then the main agent rebuilds `dict.ts` from all pair files, deduping (earlier section wins). The huge agency page (~2.4k lines) can time out a single subagent — split or resume. Done so far: shell, sidebar/menu, home (accueil), account (compte), agency (agence). Remaining: emails, integrations, seo, chat, dashboard, admin, landing, auth-pages, modals.

**Public landing has no switcher** — a logged-out visitor on `/` can't change language; the home page only shows EN if a preference was already persisted (localStorage/server). Add a public switcher only if asked.
