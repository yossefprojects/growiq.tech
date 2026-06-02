// English translations keyed by the French source string.
//
// How it works: the app is written in French. `t("…texte FR…")` returns the
// English version when the user picked English, and falls back to the French
// source string when no translation exists yet. This fallback is intentional:
// a missing entry shows French (the original), never a blank or a raw key, so
// the UI can never break mid-translation.
//
// We translate the app page by page; entries are grouped by area for clarity
// but live in a single flat map (the lookup is by exact French string).

export const en: Record<string, string> = {
  // --- Shell / language switcher ---
  Français: "French",
  Anglais: "English",
  "Langue": "Language",
  "Changer de langue": "Change language",
};
