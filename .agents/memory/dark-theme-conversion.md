---
name: Forced dark theme conversion sweep
description: Pitfalls when converting the whole /app to a forced dark theme — the easy-to-miss surfaces.
---

# Forced dark theme — what a first pass misses

A first conversion pass (subagents converting `bg-white`/`text-gray-900` → theme tokens) reliably handles the common visible surfaces but MISSES three categories that only an architect review / state-specific check catches:

1. **Conditional / rare-state surfaces** — alert & warning panels (`bg-amber-50`, `bg-red-50`, `bg-blue-50`, `bg-green-50` with `text-*-800/900`) and status-badge pills (`bg-*-100 text-*-700/800`). They render only on error/empty/warn states, so screenshots of the happy path don't reveal them.
2. **Inline-style fallbacks** — e.g. public lead-capture landing used `style={{ background: page.style.bgColor || "#f8fafc" }}`. A light hardcoded fallback survives every className sweep because it isn't a Tailwind class. Grep for hex `#f`/`#fff`/`bgColor ||` too.
3. **Semantic colors** — keep the hue, drop the lightness: convert light panels to `bg-<hue>-500/10 border-<hue>-500/30 text-<hue>-200/300`, NOT to neutral `bg-card`. Preserves the amber=warn / red=error meaning on dark.

**Why:** these are invisible without auth + the specific app state, so they slip past typecheck, build, and home/login screenshots.
**How to apply:** after the main sweep, `rg` for `bg-(amber|red|blue|green|gray)-(50|100)`, `text-(amber|red|blue|green)-(700|800|900)`, and inline hex fallbacks across pages; verify authed interior states via the testing skill (Clerk `testClerkAuth: true`).
