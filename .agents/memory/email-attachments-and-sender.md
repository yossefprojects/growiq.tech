---
name: Email attachments & sender address
description: How email-campaign attachments are stored/sent and why the "from" address can't be freely typed
---

# Email attachments

Attachments on an email campaign are stored in the **public** object-storage bucket
(`uploadPublicBuffer`), with `{filename, path, contentType, size}` kept in the
`email_campaigns.attachments` jsonb column. At send time they are downloaded once
(`downloadPublicObject`) and passed to Resend as base64 `content` (NOT as a `path`
URL).

**Why base64 content, not Resend `path` URL:** base64 makes the message
self-contained and behaves identically in dev and prod; a `path` URL would depend
on Resend being able to fetch our domain at send time.

**Why public bucket (tradeoff):** chosen for simplicity/reuse of existing helpers.
Access relies on an unguessable random path, not authz — acceptable for marketing
attachments, but if attachment confidentiality is ever required, migrate to private
storage + signed URLs.

**How to apply:** download attachments ONCE before the recipient loop, never per
recipient. Any attachment download failure must throw into the send route's outer
try/catch so the campaign lands in `failed`, not stuck in `sending`.

# Sender ("from") address

You cannot send from an arbitrary typed address — Resend requires the sender domain
to be verified. Resolution order (see `lib/email.ts sendEmail`): user's own Resend
key + verified `fromEmail` → shared GrowIQ freemium key (admin domain, user can't
customize) → env fallback.

**How to apply:** the campaign send UI should SURFACE the active sender (via
`GET /email/sender`) and, when on freemium, link to `/app/integrations` to connect
their own Resend domain — never offer a free-text "from" field.
