---
name: Publish-gating must use per-user status, not admin-gated endpoints
description: Why frontend channel/publish gating reads /api/integrations, not /api/meta/status
---

# Publish/launch gating reads per-user status, not admin-gated endpoints

Any frontend that decides whether a publish/launch button is enabled (e.g.
`useConnectedChannels`) must read the **per-user** connection truth from
`/api/integrations` (`facebook.connected` / `instagram.connected` /
`linkedin.connected`), optionally OR-ed with the admin-only `/api/meta/status`
for the legacy admin-global-creds case.

**Why:** `/api/meta/status` (and `/api/meta/profile`) are admin-gated — they
return `{facebook:false, instagram:false}` (or 404) for non-admins, reporting
only the global GrowIQ admin creds, NOT the user's own `user_integrations`
(platform=meta) connection. A non-admin who connects their own FB/IG via OAuth
or manual token would still see the publish button greyed out and the preview
avatar/name 404, because the UI was reading the wrong (admin) source.

**How to apply:** For multi-tenant per-user features, the source of truth is the
per-user route (`/api/integrations`, `/api/facebook/status`). Treat
`/api/meta/*` admin endpoints purely as a legacy admin fallback, never as the
primary signal. Same trap applies to any new "is X connected?" UI check.
