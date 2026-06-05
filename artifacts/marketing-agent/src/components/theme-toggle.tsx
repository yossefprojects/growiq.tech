import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

type Variant = "icon" | "landing" | "row";

/**
 * Bouton de bascule clair/sombre. Trois variantes :
 * - `landing` : pastille ronde claire pour la navbar (toujours sombre) de la home.
 * - `row` : ligne pleine largeur avec libellé, pour le menu latéral de l'app.
 * - `icon` (défaut) : bouton icône discret basé sur les tokens (header mobile).
 *
 * L'icône affichée indique l'action : soleil = passer en clair (on est en
 * sombre), lune = passer en sombre (on est en clair).
 */
export function ThemeToggle({
  variant = "icon",
  className,
  testId = "theme-toggle",
}: {
  variant?: Variant;
  className?: string;
  testId?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const isDark = theme === "dark";
  const label = isDark ? t("Passer en mode clair") : t("Passer en mode sombre");
  const Icon = isDark ? Sun : Moon;

  if (variant === "landing") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        title={label}
        data-testid={testId}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 50,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer",
          transition: "background .2s, color .2s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          e.currentTarget.style.color = "rgba(255,255,255,0.85)";
        }}
      >
        <Icon size={18} />
      </button>
    );
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        data-testid={testId}
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md px-2 py-1.5 transition-colors w-full",
          className,
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{isDark ? t("Mode clair") : t("Mode sombre")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors",
        className,
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
