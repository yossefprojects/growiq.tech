---
name: Meta (FB/IG) connection troubleshooting
description: Diagnosing why users can't connect Facebook/Instagram in GrowIQ
---

# Meta connection troubleshooting

## Error "#100 Tried accessing nonexisting field (accounts)"
- Happens on the `/me/accounts` Graph call in the **manual token paste** flow.
- **Cause:** user pasted a **Page** or **App** token instead of a **User** access token. `/me` still succeeds (returns the page/app node), but that node has no `accounts` edge.
- **Fix for user:** generate a *User Access Token* ("Get User Access Token") with `pages_show_list`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
- Detected server-side via `isWrongTokenTypeError()` (code 100 + message "nonexisting field (accounts)") → returns clear FR message.

## "Application inactive" during OAuth popup
- **Cause:** the Meta app **Growiq.ai (ID 3484923875007702)** is in **Development mode**, not Live.
- In dev mode only roles (admin/developer/tester) can OAuth & publish. Public users are blocked.
- **Why:** going Live requires Business Verification + App Review of `pages_manage_posts` & `instagram_content_publish`, then flipping the Live switch.

**Key guidance:** the manual token flow is too error-prone for non-technical users. Since the account owner is the app **admin**, steer them to the one-click OAuth button (works in dev mode for admins/testers). Reserve manual paste as a last resort.

**Note:** the "Getting Started with Marketing API" email = ads/paid (Marketing API) access only; it does NOT mean organic-publishing App Review is approved.
