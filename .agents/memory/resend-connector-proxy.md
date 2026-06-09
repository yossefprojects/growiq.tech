---
name: Replit connector credentials are proxy-only
description: Why @replit/connectors-sdk never returns api_key, and to send via the proxy instead of extracting the key
---

# Replit connector credentials are proxy-only (use connectors.proxy)

The public `@replit/connectors-sdk` (v0.4.x) does **not** expose a connection's
secret settings (e.g. Resend `api_key` / `from_email`) to app code.
`listConnections({ connector_names })` returns the connection object but with no
credentials in `settings`/`integration`/`metadata`; passing
`expand: ['settings'|'credentials'|...]` is rejected with **400 Bad Request**
(only `expand: ['connector']` is valid). The client exposes only:
`proxy`, `listConnections`, `getProxyUrl`, `getProxyHeaders`, `getCliConfig`,
`createProxyFetch`.

The intended way to call the third-party API is the **proxy**, which injects the
Authorization header on Replit's side (key never reaches app code):

```ts
const conns = new ReplitConnectors();
const resp = await conns.proxy("resend", "/emails", { method: "POST", body: {...} });
// or createProxyFetch("resend") for a fetch-compatible wrapper
```

**The trap:** the agent's *sandbox* `listConnections('resend')` (a privileged
host function in code_execution) DOES return `settings.api_key` + `from_email`.
That made it look like the app could read the key too — it cannot. Don't trust
the sandbox's connector shape as proof of what the SDK returns; verify with the
actual SDK from the package context
(`pnpm --filter @workspace/api-server exec node ...`).

**Why this matters:** a long-standing bug had `getResendConnectorCreds()`
searching `conn.settings.api_key` (always absent) → `sendEmail` returned
"Aucun fournisseur email configuré" in **both dev and prod**. The connector was
reachable the whole time; the code just looked for the key in a place the SDK
never populates. The earlier "connector unavailable in deployment" theory was
wrong.

**How to apply:** for any Replit connector (Resend, etc.) called from server
code, send via `connectors.proxy(...)` / `createProxyFetch(...)`. Decide
availability with `listConnections(...).length > 0` (don't try to read the key).
Keep an explicit env-key path (e.g. `RESEND_API_KEY`) only as an independent
fallback, not as the connector path.
