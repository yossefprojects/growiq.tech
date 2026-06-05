import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* localStorage indisponible (mode privé, etc.) */
  }
  return "dark";
}

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Applique le thème sur <html>. `withTransition` ajoute une classe temporaire
 * `.theme-transition` (transitions douces 0.3s définies dans index.css) puis la
 * retire — on évite ainsi une transition permanente sur `*` (coûteuse au scroll).
 * Le timer est annulé/réarmé pour gérer proprement les bascules rapides.
 */
function applyThemeClass(theme: Theme, withTransition: boolean): void {
  const root = document.documentElement;
  if (withTransition) {
    if (transitionTimer !== null) clearTimeout(transitionTimer);
    root.classList.add("theme-transition");
    transitionTimer = setTimeout(() => {
      root.classList.remove("theme-transition");
      transitionTimer = null;
    }, 320);
  }
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  // Synchronise la classe au montage (le script inline de index.html l'a déjà
  // posée pour éviter le flash ; on reste cohérent ici sans transition).
  useEffect(() => {
    applyThemeClass(theme, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyThemeClass(next, true);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyThemeClass(next, true);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé à l'intérieur d'un ThemeProvider");
  return ctx;
}
