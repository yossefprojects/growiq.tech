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
- Verified `META_APP_ID` env == 3484923875007702, so GrowIQ's OAuth targets the correct app — "Application inactive" is purely the Meta dev-mode block, NOT a config/redirect bug.
- **Gotcha:** even the owner sees "Application inactive" if (a) the Facebook account logged into the browser ≠ the app's admin account, or (b) they are a Business-portfolio admin but NOT listed under **App Roles → Roles**. Being a BM admin ≠ being an app role. Fix: add that exact FB account as Admin/Tester under App Roles and accept the invite.

**Key guidance:** the manual token flow is too error-prone for non-technical users. Since the account owner is the app **admin**, steer them to the one-click OAuth button (works in dev mode for admins/testers). Reserve manual paste as a last resort.

**Note:** the "Getting Started with Marketing API" email = ads/paid (Marketing API) access only; it does NOT mean organic-publishing App Review is approved.

## OAuth dialog fails entirely: "Invalid Scopes" / "Ce contenu n'est pas disponible"
- **Cause:** the OAuth `scope` list contained an advanced permission the app is NOT approved for. Known offenders seen here: `ads_management`/`ads_read` (added when wiring Meta Ads) AND `business_management`. Requesting *any* un-approved advanced scope makes Meta reject the **whole** authorization dialog — even the basic publishing scopes that would otherwise work for an admin/tester in dev mode.
- **`business_management` is in the same trap as the ads scopes** — it requires App Review + Business verification. It is NOT needed for page/IG publishing and was a leftover that silently broke the dialog after the ads scopes were removed. Don't assume removing `ads_*` is enough; audit the whole list.
- The dev-only diagnostic ("This message is only shown to developers... Invalid Scopes: ...") confirms the logged-in user IS an app role; the block is scope-level, not role-level.
- **Minimal publishing scope set that works:** `pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish` (Facebook adds `public_profile` automatically; `email` is unnecessary and best omitted).
- **Fast verification without a browser/FB login:** build the authorize URL with the real `client_id` + the 5 scopes and `curl -L` it. A normal **login page** (HTTP 200, "log in"/"password", title "Facebook") = scopes accepted. An "Invalid Scopes"/"isn't available"/"n'est pas disponible" page = a bad scope is still present. (Don't print the app id.)
- **Rule:** never put App-Review-gated advanced scopes (ads_management, ads_read, business_management, and any not-yet-approved permission) in the default login scope list. Keep the login to the minimum needed, and gate advanced scopes behind a separate opt-in re-OAuth that you only enable after that specific permission is approved.
