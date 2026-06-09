---
name: Resend freemium sender domain
description: How shared/freemium email sending is configured and the gotcha that breaks it
---

# Shared GrowIQ Resend sending — sender domain

The shared Resend connector's `from_email` is a personal **@gmail.com** address.
Resend rejects any send from a domain it cannot verify, returning HTTP 403
`"The <domain> domain is not verified..."`. This is a **config/DNS issue, not a code
bug** — the send code is correct, Resend refuses the sender. Don't try to fix it by
editing the send logic.

**How it's solved:** the env var `RESEND_SHARED_FROM` (shared scope, e.g.
`GrowIQ <contact@growiq.tech>`) holds a sender on a domain verified in Resend.
`sendEmail` prefers it: `input.from || SHARED_FROM || connector/env fromEmail` on the
connector (freemium), system, and env-key paths. Per-user own Resend key still wins
above all. `GET /email/sender` parses this var to show the active sender to freemium
users.

**Gotcha / why it matters:** if `RESEND_SHARED_FROM` is ever unset (esp. in prod),
sending silently falls back to the connector's Gmail and starts failing 403 again.
Always keep it defined in every runtime env.

**Verifying a domain in Resend (one-time, admin + DNS):** add the domain on
resend.com/domains, then create the MX + TXT(SPF) + TXT(DKIM) records it shows in the
domain's DNS zone (OVH etc.). The send-only Resend API key can't list domains (401
"restricted to only send emails") — the only programmatic check is an actual test
send and reading the 200/403.

**Per-user path** (own Resend key + verified domain via /app/integrations,
platform=resend) bypasses the shared sender entirely.
