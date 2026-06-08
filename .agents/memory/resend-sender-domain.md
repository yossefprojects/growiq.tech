---
name: Resend freemium sender domain blocker
description: Why shared/freemium email sending fails (gmail from) and how to unblock it
---

# Shared GrowIQ Resend sending is blocked by an unverified sender domain

The shared Resend connector's `from_email` is a personal **@gmail.com** address.
Resend rejects any send from a domain it cannot verify, so the freemium path
(`sendEmail` → `resend-connector`) fails with HTTP 403:
`"The gmail.com domain is not verified..."`. Confirmed with a real test send.

**Why this matters:** the app code is correct — it forwards the request to Resend;
Resend refuses because of the sender address. So "email campaigns don't work" for
freemium users is a **config/DNS issue, not a code bug**. Don't go editing the send
code to fix this.

**How to unblock (admin, no code):** verify a real domain (e.g. growiq.tech) on
resend.com/domains via DNS records, then set the shared connector's from_email to an
address on that domain (e.g. hello@growiq.tech).

**Per-user path already works:** a user who connects their own Resend key + verified
domain in /app/integrations (platform=resend) sends fine (`resend-user`), bypassing
the shared sender entirely.
