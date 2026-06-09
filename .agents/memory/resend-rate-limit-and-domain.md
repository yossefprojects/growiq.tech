---
name: Resend send failures — 429 rate limit + unverified domain
description: Why a bulk email campaign shows mass failures (0 sent) and the two distinct root causes to check first.
---

# Resend bulk-send failures

When a campaign reports many failures / 0 sent, query prod `email_events` (payload.error per recipient) and split by HTTP status — there are two unrelated causes:

## 1. HTTP 403 "domain ... is not verified" — USER action, not a code bug
A per-user Resend key (`provider=resend-user`) with a `from` on a domain the user has NOT verified in THEIR own Resend account → every send 403s. Fix is on the user side: verify the sending domain at resend.com/domains (DNS records). No code change helps this.
**Why:** each user brings their own Resend account/key; verification is per-account. Freemium/shared path uses `RESEND_SHARED_FROM` (a verified domain) so it doesn't hit this.

## 2. HTTP 429 rate_limit_exceeded "only 2 requests per second" — code bug
Resend's default limit is **2 req/s**. A tight send loop bursts well above that → most sends 429.
**Fix applied:** throttle the send loop (~550ms spacing, ~1.8 req/s) AND retry-on-429 inside the send call, honoring the `Retry-After` header, else bounded exponential backoff (max retries 4). Both the API-key path (`callResend`) and connector-proxy path (`sendViaResendProxy`) need the retry.
**How to apply:** any new bulk-send path must throttle + retry; a single-loop throttle does NOT protect against concurrent campaigns on the same account.

## Known remaining tradeoff
Synchronous send of N emails at ~1.8/s takes ~N*0.55s (194 ≈ ~2 min) → real risk of HTTP/Autoscale timeout on large lists. A proper queue/worker (202 async job) is needed beyond a few hundred recipients. Not yet built.
