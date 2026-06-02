import { Globe } from "lucide-react";
import { useI18n, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; label: string; short: string }[] = [
  { value: "fr", label: "Français", short: "FR" },
  { value: "en", label: "Anglais", short: "EN" },
];

/**
 * Sélecteur de langue compact (FR / EN). Présent dans le menu, donc accessible
 * depuis toutes les pages de l'app. La préférence est mémorisée par utilisateur
 * (localStorage + base de données via /api/me/language).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={t("Changer de langue")}
    >
      <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex items-center rounded-md border border-border overflow-hidden">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.value}
            type="button"
            onClick={() => setLanguage(lang.value)}
            aria-pressed={language === lang.value}
            data-testid={`button-lang-${lang.value}`}
            className={cn(
              "px-2 py-1 text-xs font-semibold transition-colors",
              language === lang.value
                ? "bg-[#5b54d6] text-white"
                : "bg-transparent text-muted-foreground hover:bg-secondary/60",
            )}
            title={t(lang.label)}
          >
            {lang.short}
          </button>
        ))}
      </div>
    </div>
  );
}
