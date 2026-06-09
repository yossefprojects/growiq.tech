---
name: Webhook tenant binding
description: Signature verification proves payload origin, NOT authorization of the target record — multi-tenant webhooks must bind the referenced entity to the verified tenant.
---

# Webhook tenant binding (Resend events)

When each tenant connects their OWN provider account (per-user signing secret), a valid
Svix/HMAC signature only proves the payload came from a known account — it does NOT prove
that the IDs inside the payload (e.g. `campaign_id`) belong to that tenant.

**The attack:** user A knows their own `whsec_*`. They craft a payload with `user_id=A`
(so the server picks A's secret), sign it validly, but set `campaign_id` to user B's
campaign. Signature verifies → server inflates B's open/click counters. Cross-tenant
stats injection.

**Why:** picking the secret by a non-trusted tag + verifying the signature authenticates
the *origin* of the payload, but authorization of the *target* is a separate concern.

**How to apply:** after `wh.verify`, re-read the `user_id` tag from the *verified* payload,
load the referenced entity, and assert ownership BEFORE any write:
- per-user-secret path → require `entity.userId === verifiedUserId`, else 403.
- shared/env-secret path (freemium GrowIQ account) → if a `user_id` tag is present it must
  match the entity owner; mismatch → 403.
This pattern applies to any future per-tenant webhook, not just Resend.
