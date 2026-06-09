---
name: Agency/email brief input length validation
description: Why long free-text briefs produced a generic 400 error toast, and the client/server contract rule to keep
---

# Agency brief input length — client/server contract

The agency tunnel collects free-text `product` / `audience` (and an email `subject`)
from non-technical users who often write long descriptions. The bug: client
textareas/inputs had no `maxLength` (only a min-length gate), while the server Zod
schemas capped fields with `.max(N)`. A user exceeding the cap got a hard HTTP 400,
surfaced as the scary generic toast "Quelque chose n'a pas marché de notre côté."

**Key inconsistency to remember:** the two AI-generation flows handle over-length
differently —
- the **social/ads** flow (`/agency/generate`) is lenient: it *truncates* with
  `cap(field, 500)` server-side, so it never 400s on length.
- the **email** flow (`/email/campaigns/generate`) *hard-rejects* via Zod
  `.max(...)`, so over-length briefs 400.

**Rule:** every free-text field bound to a server Zod `.max(N)` must have a matching
client `maxLength={N}` (or be truncated server-side). When adding a new brief field
or AI-generation route, keep the client input cap and the server schema cap in
lockstep, or the user hits an opaque 400.

**Why:** the user reported "toujours le même message d'erreur"; production logs
(`POST /api/email/campaigns/generate` → 400, repeated) were the only way to see it —
the client only shows the friendly fallback, the server doesn't log the Zod details.
When debugging a generic agency error toast, **check deployment logs for the failing
POST status first** rather than guessing from the UI.
