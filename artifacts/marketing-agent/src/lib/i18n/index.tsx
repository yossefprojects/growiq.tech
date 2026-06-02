import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { en } from "./dict";

export type Language = "fr" | "en";

const STORAGE_KEY = "growiq.lang";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /**
   * Translate a French source string. Returns the English version when the
   * current language is "en" and a translation exists; otherwise returns the
   * French source unchanged. Optional `vars` replace `{name}` placeholders.
   */
  t: (fr: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "fr";
}

function applyVars(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  // Sync the chosen language from the server once signed in, so the preference
  // follows the user across devices. localStorage gives an instant first paint.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = (await res.json()) as { language?: string };
        const serverLang: Language = data.language === "en" ? "en" : "fr";
        if (!cancelled) {
          setLanguageState(serverLang);
          window.localStorage.setItem(STORAGE_KEY, serverLang);
        }
      } catch {
        // Best-effort: keep the locally stored language on network errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      window.localStorage.setItem(STORAGE_KEY, lang);
      // Persist server-side (best-effort). The local change applies immediately.
      (async () => {
        try {
          const token = await getToken();
          await fetch(`${basePath}/api/me/language`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ language: lang }),
          });
        } catch {
          // Ignore: the preference is still applied locally and in localStorage.
        }
      })();
    },
    [getToken],
  );

  const t = useCallback(
    (fr: string, vars?: Record<string, string | number>) => {
      if (language === "en") {
        const translated = en[fr];
        return applyVars(translated ?? fr, vars);
      }
      return applyVars(fr, vars);
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

/** Convenience hook when you only need the translate function. */
export function useT(): I18nContextValue["t"] {
  return useI18n().t;
}
