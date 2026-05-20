import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Rocket,
  Image as ImageIcon,
  CalendarClock,
  Mail,
  Target,
  Wrench,
  PartyPopper,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

interface Slide {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  visual: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    title: "Bienvenue dans votre Agent Marketing IA",
    description:
      "Un stratège marketing senior disponible 24/7, qui exécute vos campagnes de A à Z. Laissez-moi vous montrer ce qu'il sait faire en 30 secondes.",
    accent: "from-fuchsia-500 to-purple-600",
    visual: (
      <div className="relative h-32 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute w-28 h-28 rounded-full border-2 border-dashed border-fuchsia-300/50"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/40"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>
      </div>
    ),
  },
  {
    icon: Rocket,
    title: "Lancez des campagnes complètes en 1 clic",
    description:
      "Choisissez un type (SEO, réseaux sociaux, email, local, influence…), décrivez votre business, et obtenez une stratégie complète avec livrables prêts à l'emploi.",
    accent: "from-orange-500 to-pink-600",
    visual: (
      <div className="h-32 flex items-center justify-center gap-2">
        {["SEO", "Social", "Email", "Local"].map((label, i) => (
          <motion.div
            key={label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
            className="px-3 py-2 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 text-white text-xs font-semibold shadow-md"
          >
            {label}
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: ImageIcon,
    title: "Générez des visuels en quelques secondes",
    description:
      "Pour chaque campagne, créez des images professionnelles avec l'IA. Bannières, posts Instagram, visuels de pub — tout est généré sur mesure.",
    accent: "from-cyan-500 to-blue-600",
    visual: (
      <div className="h-32 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: i * 0.2, type: "spring" }}
            className="w-20 h-20 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md"
          >
            <ImageIcon className="w-8 h-8 text-white" />
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: CalendarClock,
    title: "Programmez vos publications à l'avance",
    description:
      "Planifiez vos posts et emails sur plusieurs jours. Le système les publie tout seul au bon moment, pendant que vous dormez.",
    accent: "from-emerald-500 to-teal-600",
    visual: (
      <div className="h-32 flex items-center justify-center">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 21 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`w-5 h-5 rounded ${
                [3, 7, 12, 16, 19].includes(i)
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm"
                  : "bg-emerald-100 dark:bg-emerald-900/30"
              }`}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Mail,
    title: "Envoyez de vrais emails à vos contacts",
    description:
      "Newsletter, relances, annonces… L'agent envoie de vrais emails (via Resend) à votre liste de diffusion, immédiatement ou programmés.",
    accent: "from-rose-500 to-red-600",
    visual: (
      <div className="h-32 flex items-center justify-center relative">
        <motion.div
          animate={{ x: [0, 80, 80], y: [0, 0, -10], opacity: [1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
          className="absolute w-14 h-10 rounded-md bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-md"
        >
          <Mail className="w-6 h-6 text-white" />
        </motion.div>
        <div className="absolute right-4 w-6 h-6 rounded-full border-2 border-rose-400 flex items-center justify-center">
          <motion.div
            animate={{ scale: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5, delay: 1.5 }}
            className="w-3 h-3 rounded-full bg-rose-500"
          />
        </div>
      </div>
    ),
  },
  {
    icon: Target,
    title: "Capturez des leads avec des pages dédiées",
    description:
      "Créez en 2 minutes une page publique pour collecter des inscriptions (téléchargement d'un guide, demande de devis, inscription événement…). Lien à partager partout.",
    accent: "from-violet-500 to-indigo-600",
    visual: (
      <div className="h-32 flex items-center justify-center">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-48 rounded-lg border-2 border-violet-300 bg-white dark:bg-slate-900 p-3 shadow-md"
        >
          <div className="h-2 w-24 bg-violet-300 rounded mb-2" />
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1" />
          <div className="h-1.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-6 w-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded text-white text-[10px] font-semibold flex items-center justify-center"
          >
            S'inscrire
          </motion.div>
        </motion.div>
      </div>
    ),
  },
  {
    icon: Wrench,
    title: "Suivez tout depuis la Boîte à outils",
    description:
      "Vos leads, vos pages de capture, vos publications programmées — tout est centralisé. Export CSV en 1 clic pour récupérer vos contacts.",
    accent: "from-amber-500 to-orange-600",
    visual: (
      <div className="h-32 flex flex-col items-center justify-center gap-1.5">
        {["Leads (47)", "Pages (3)", "Posts programmés (12)"].map((label, i) => (
          <motion.div
            key={label}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.2 }}
            className="px-4 py-1.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-medium shadow-sm w-48 text-center"
          >
            {label}
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: PartyPopper,
    title: "À vous de jouer !",
    description:
      "Commencez par lancer votre première campagne, puis créez une page de capture pour collecter vos premiers leads. Bonne stratégie !",
    accent: "from-green-500 to-emerald-600",
    visual: (
      <div className="h-32 flex items-center justify-center relative overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/40"
        >
          <PartyPopper className="w-10 h-10 text-white" />
        </motion.div>
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{
              x: Math.cos((i / 8) * Math.PI * 2) * 80,
              y: Math.sin((i / 8) * Math.PI * 2) * 60,
              opacity: 0,
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ["#10b981", "#f59e0b", "#ec4899", "#3b82f6"][i % 4],
            }}
          />
        ))}
      </div>
    ),
  },
];

const STORAGE_KEY = "marketing-agent-welcome-seen-v1";
const SLIDE_DURATION = 4500;

let inMemorySeen = false;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WelcomeTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setPaused(false);
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || paused || reducedMotion) return;
    if (index >= SLIDES.length - 1) return;
    const t = setTimeout(() => setIndex((i) => i + 1), SLIDE_DURATION);
    return () => clearTimeout(t);
  }, [open, paused, index, reducedMotion]);

  if (!open) return null;
  const slide = SLIDES[index];
  const Icon = slide.icon;
  const isLast = index === SLIDES.length - 1;

  const handleClose = () => {
    inMemorySeen = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {}
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === " " || e.key === "Enter") {
      if (e.target === dialogRef.current) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-tour-title"
        aria-describedby="welcome-tour-desc"
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden border outline-none focus:ring-2 focus:ring-primary/40"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        data-testid="welcome-tour"
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          data-testid="welcome-close"
          aria-label="Fermer la présentation"
        >
          <X className="w-4 h-4" />
        </button>

        <div className={`h-1 bg-gradient-to-r ${slide.accent}`}>
          <div className="flex h-full">
            {SLIDES.map((_, i) => (
              <div key={i} className="flex-1 relative">
                {i < index && <div className="absolute inset-0 bg-white/30" />}
                {i === index && !reducedMotion && (
                  <motion.div
                    key={index}
                    initial={{ width: "0%" }}
                    animate={{ width: paused ? undefined : "100%" }}
                    transition={{ duration: SLIDE_DURATION / 1000, ease: "linear" }}
                    className="absolute inset-y-0 left-0 bg-white/40"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
            className="p-8"
          >
            <div
              className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${slide.accent} text-white shadow-md mb-4`}
            >
              <Icon className="w-6 h-6" />
            </div>

            <h2
              id="welcome-tour-title"
              className="text-2xl font-bold tracking-tight text-foreground mb-3"
            >
              {slide.title}
            </h2>
            <p
              id="welcome-tour-desc"
              className="text-muted-foreground leading-relaxed mb-6 min-h-[72px]"
            >
              {slide.description}
            </p>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-xl py-6 mb-6">
              {slide.visual}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1"
            data-testid="welcome-prev"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>

          <div className="text-xs text-muted-foreground">
            {index + 1} / {SLIDES.length}
          </div>

          {isLast ? (
            <button
              onClick={handleClose}
              className={`flex items-center gap-2 bg-gradient-to-r ${slide.accent} text-white rounded-lg px-5 py-2 text-sm font-semibold shadow-md hover:opacity-90 transition-opacity`}
              data-testid="welcome-finish"
            >
              <Rocket className="w-4 h-4" />
              Commencer
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
              className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-secondary"
              data-testid="welcome-next"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function shouldShowWelcomeTour(): boolean {
  if (inMemorySeen) return false;
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    // localStorage indisponible (mode privé, blocage) → afficher quand même
    // une fois par session via le flag en mémoire.
    return true;
  }
}
