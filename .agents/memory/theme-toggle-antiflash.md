---
name: Theme toggle anti-flash sync
description: The inline anti-flash script and the React theme-reader must parse stored theme with the same rule, or invalid/legacy values cause a flash.
---

# Theme toggle anti-flash sync

The app has a light/dark toggle: an inline `<script>` in `index.html` sets the
initial `.dark`/`.light` class on `<html>` before React mounts (anti-flash), and
a `ThemeProvider` (`src/lib/theme.tsx`) takes over after mount.

**Rule:** both code paths must parse `localStorage.theme` identically — only the
exact string `"light"` selects light mode; any other value (absent, legacy like
`"system"`, invalid) defaults to dark.

**Why:** if the inline script and the React reader disagree on an unexpected
value, the inline script paints one theme and React re-paints the other at mount
→ a visible flash (the exact thing the inline script exists to prevent).

**How to apply:** when changing the default theme, the storage key, or the set of
valid theme values, update BOTH the inline script in `index.html` and the reader
in `src/lib/theme.tsx` in lockstep.
