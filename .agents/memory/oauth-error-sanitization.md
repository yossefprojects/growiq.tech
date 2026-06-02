---
name: OAuth error sanitization (integrations UI)
description: Why OAuth result strings must be mapped to friendly French before reaching the UI on /app/integrations
---

# OAuth error sanitization

Raw OAuth result strings reach the integrations UI from three independent surfaces, all of which can carry technical Meta codes (#200, #190, scope names like `pages_manage_posts`) or backend text:

1. query-string status after redirect (`?facebook=...`)
2. `postMessage` status from the OAuth popup
3. the backend response `text()` when `/api/auth/<platform>/start` fails

**Rule:** never pass any of these straight into a toast. Map through a friendly-error helper that returns plain French and never echoes raw codes.

**Why:** product requirement — non-technical users ("mamie 70 ans"); the permission/app-review case must read "Tu n'as pas encore accès à cette fonctionnalité — contacte GrowIQ." A code-review caught toasts leaking raw text even after the card-level message was sanitized.

**How to apply:** the Facebook/Instagram path is sanitized via the friendly-error helpers in `integrations.tsx`. If you add a new OAuth provider whose errors are user-facing, sanitize all three surfaces the same way. Keep raw strings in dev logs only.
