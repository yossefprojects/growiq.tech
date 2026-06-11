---
name: Deployment build failures that local typecheck/build miss
description: Why a deploy build can fail even when local `pnpm run typecheck` is green; how to reproduce it.
---

# Deploy build vs local typecheck divergence

Two independent traps cause "deploy build failed" while local checks look green:

## 1. Stale incremental `.tsbuildinfo` masks real type errors
`tsc --build` / `tsc --noEmit` use incremental caches (`*.tsbuildinfo`). A file unchanged since a prior cached-green build is NOT rechecked — so a type error introduced by a later git merge can sit hidden. Local `pnpm run typecheck` passes; the deployment's clean build catches it.
**How to apply:** to reproduce a deploy build, delete caches first: `find . -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete`, then run the build. Do this in the pre-publish check.

## 2. Deployment builds per-artifact production commands, NOT root `pnpm run build`
Each deployable artifact's `.replit-artifact/artifact.toml` defines `[services.production].build`. The api-server builds with **esbuild** (`build.mjs`), which must RESOLVE every import. So importing a package that isn't in dependencies (e.g. a Resend SDK that was never installed) breaks the deploy bundle with "Could not resolve 'X'" — even though esbuild strips/ignores type errors and local `tsc` (which resolves types differently) may not flag it.
- An artifact with **no `[services.production]`** (e.g. mockup-sandbox, kind=design) is NOT deployed. Its `pnpm run build` failing from bash (e.g. "PORT required") is a false-positive — ignore it for deploy.
- Verify the actual deployed artifacts with their real prod env: api-server `pnpm --filter @workspace/api-server run build`; marketing-agent `PORT=22821 BASE_PATH=/ pnpm --filter @workspace/marketing-agent run build`.

**Why:** this exact combo (uninstalled `resend` SDK import + z.record v4 errors hidden by cache) made a deploy fail while local typecheck was green. The codebase sends email proxy-only via the shared `sendEmail` helper — never import the Resend SDK.
