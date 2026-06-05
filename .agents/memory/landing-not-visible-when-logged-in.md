---
name: "Landing changes invisible to logged-in user"
description: Why the owner reports "nothing changed" on growiq.tech after a landing redesign.
---

# "Rien n'a changé" after a landing redesign — almost always the auth redirect

When the user says the public landing redesign did nothing / only added a dark background, the usual cause is NOT that the work is missing — it's that `/` redirects authenticated users straight to `/app` (HomeRedirect in App.tsx). The owner is logged in, so they never see `/`; they only ever see the dashboard.

**Why:** the new premium landing lives on `/` and only renders for signed-out visitors (future customers). The owner's own browser session is authenticated.

**How to apply:** before re-doing landing work, confirm whether the user actually viewed `/` while logged out. Tell them to open growiq.tech in a private/incognito window (or log out). Offer a screenshot of `/` as proof. Don't just repeat "it's already done" — that escalates frustration; show it and explain the redirect.
