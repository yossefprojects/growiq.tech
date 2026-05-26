import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Facebook,
  Instagram,
  Sparkles,
  Target,
  Megaphone,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import {
  useGetOpenaiBusinessProfile,
  useUpsertOpenaiBusinessProfile,
  useGetMetaStatus,
  getGetOpenaiBusinessProfileQueryKey,
  getGetMetaStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type ToneOption = { id: string; label: string; description: string };

const TONES: ToneOption[] = [
  { id: "chaleureux", label: "Chaleureux & humain", description: "Proche, bienveillant, tutoiement" },
  { id: "professionnel", label: "Professionnel", description: "Sérieux, expert, vouvoiement" },
  { id: "fun", label: "Fun & décalé", description: "Léger, plein d'humour, emojis" },
  { id: "premium", label: "Premium & élégant", description: "Raffiné, valorisant, haut de gamme" },
];

const GOALS: { id: string; label: string; emoji: string }[] = [
  { id: "notoriete", label: "Faire connaître ma marque", emoji: "📣" },
  { id: "clients", label: "Trouver de nouveaux clients", emoji: "🎯" },
  { id: "ventes", label: "Vendre plus", emoji: "💰" },
  { id: "fidelisation", label: "Fidéliser mes clients", emoji: "❤️" },
  { id: "communaute", label: "Construire une communauté", emoji: "🤝" },
];

const ONBOARDING_KEY = "growiq:onboarding-skipped";

export function shouldShowOnboarding(profileLoaded: boolean, completed: boolean): boolean {
  if (!profileLoaded) return false;
  if (completed) return false;
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_KEY) !== "1";
}

export function OnboardingWizard({ open, onClose, onComplete }: OnboardingWizardProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const { data: profile } = useGetOpenaiBusinessProfile({
    query: { queryKey: getGetOpenaiBusinessProfileQueryKey(), enabled: open },
  });
  const { data: metaStatus, isLoading: metaLoading } = useGetMetaStatus({
    query: { queryKey: getGetMetaStatusQueryKey(), enabled: open },
  });

  const upsert = useUpsertOpenaiBusinessProfile();

  const [businessName, setBusinessName] = useState("");
  const [activity, setActivity] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState<string>("");
  const [primaryGoal, setPrimaryGoal] = useState<string>("");

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.businessName ?? "");
      setActivity(profile.activity ?? "");
      setTargetAudience(profile.targetAudience ?? "");
      setTone(profile.tone ?? "");
      setPrimaryGoal(profile.primaryGoal ?? "");
    }
  }, [profile]);

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_KEY, "1");
    }
    onClose();
  };

  const handleFinish = () => {
    upsert.mutate(
      {
        data: {
          businessName: businessName.trim() || null,
          activity: activity.trim() || null,
          targetAudience: targetAudience.trim() || null,
          tone: tone || null,
          primaryGoal: primaryGoal || null,
          onboardingCompleted: true,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetOpenaiBusinessProfileQueryKey() });
          toast.success("Profil enregistré ! L'agent va personnaliser ses conseils.");
          onComplete();
        },
        onError: (err) => {
          toastError(err, "Impossible d'enregistrer ton profil. Réessaie dans quelques instants.");
        },
      },
    );
  };

  const canGoNext = (() => {
    if (step === 0) return true;
    if (step === 1) return activity.trim().length > 1;
    if (step === 2) return tone !== "";
    if (step === 3) return primaryGoal !== "";
    return true;
  })();

  const steps = [
    {
      key: "social",
      title: "Connecte tes réseaux sociaux",
      subtitle:
        "Pour publier automatiquement à ta place. Tu peux passer cette étape — on configurera plus tard.",
      icon: Sparkles,
      content: (
        <div className="space-y-3">
          {metaLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Vérification…
            </div>
          ) : (
            <>
              <SocialRow
                icon={Facebook}
                label="Facebook"
                connected={!!metaStatus?.facebook}
                color="from-[#1877f2] to-[#0e5fc2]"
              />
              <SocialRow
                icon={Instagram}
                label="Instagram"
                connected={!!metaStatus?.instagram}
                color="from-[#e1306c] via-[#fd1d1d] to-[#fcb045]"
              />
              {(!metaStatus?.facebook || !metaStatus?.instagram) && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Pas de panique : tu pourras toujours utiliser GrowIQ sans avoir tout connecté. On
                    te rappellera quand ce sera utile.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: "business",
      title: "Parle-moi de ton business",
      subtitle: "Ça permet à l'agent de te donner des conseils vraiment adaptés à toi.",
      icon: Megaphone,
      content: (
        <div className="space-y-4">
          <Field label="Nom de ton activité ou de ta marque (optionnel)">
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ex : Le Petit Café de Marie"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b54d6]/50"
              data-testid="onboarding-name"
            />
          </Field>
          <Field label="Que fais-tu ? (en quelques mots)" required>
            <input
              type="text"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Ex : Coach sportif en ligne, restaurant italien, app de méditation…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b54d6]/50"
              data-testid="onboarding-activity"
            />
          </Field>
          <Field label="À qui tu t'adresses ? (optionnel mais recommandé)">
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Ex : Jeunes parents en région parisienne, dirigeants de PME…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b54d6]/50"
              data-testid="onboarding-target"
            />
          </Field>
        </div>
      ),
    },
    {
      key: "tone",
      title: "Quel ton veux-tu avoir ?",
      subtitle: "L'agent écrira tes posts dans ce style.",
      icon: Sparkles,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              data-testid={`onboarding-tone-${t.id}`}
              className={cn(
                "text-left rounded-xl border-2 p-4 transition-all",
                tone === t.id
                  ? "border-[#5b54d6] bg-[#5b54d6]/5 shadow-sm"
                  : "border-border hover:border-[#5b54d6]/40 hover:bg-muted/40",
              )}
            >
              <div className="font-semibold text-sm">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "goal",
      title: "Quel est ton premier objectif ?",
      subtitle: "On commencera par là. Tu pourras changer plus tard.",
      icon: Target,
      content: (
        <div className="space-y-2">
          {GOALS.map((g) => (
            <button
              key={g.id}
              onClick={() => setPrimaryGoal(g.id)}
              data-testid={`onboarding-goal-${g.id}`}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all text-left",
                primaryGoal === g.id
                  ? "border-[#5b54d6] bg-[#5b54d6]/5"
                  : "border-border hover:border-[#5b54d6]/40 hover:bg-muted/40",
              )}
            >
              <span className="text-2xl">{g.emoji}</span>
              <span className="font-semibold text-sm flex-1">{g.label}</span>
              {primaryGoal === g.id && <Check className="w-5 h-5 text-[#5b54d6]" />}
            </button>
          ))}
        </div>
      ),
    },
  ];

  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <motion.div
          initial={{ scale: 0.96, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border/60 relative">
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              aria-label="Passer l'onboarding"
              data-testid="onboarding-skip"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5b54d6] to-[#7c6cf0] text-white flex items-center justify-center">
                <current.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Étape {step + 1} sur {total}
                </div>
                <h2 id="onboarding-title" className="text-lg font-bold leading-tight">
                  {current.title}
                </h2>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
              {current.subtitle}
            </p>
            {/* Progress bar */}
            <div className="flex gap-1.5 mt-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i <= step ? "bg-[#5b54d6]" : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.key}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {current.content}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/60 flex items-center justify-between gap-3 bg-muted/30">
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="onboarding-skip-footer"
            >
              Passer pour l'instant
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                  data-testid="onboarding-back"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour
                </button>
              )}
              {!isLast ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canGoNext}
                  className={cn(
                    "inline-flex items-center gap-1 px-4 py-2 rounded-md text-sm font-semibold text-white transition-all",
                    canGoNext
                      ? "bg-[#5b54d6] hover:bg-[#4d46c4]"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                  data-testid="onboarding-next"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={!canGoNext || upsert.isPending}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-white transition-all",
                    canGoNext && !upsert.isPending
                      ? "bg-gradient-to-r from-[#5b54d6] to-[#7c6cf0] hover:from-[#4d46c4] hover:to-[#6b5ce0] shadow-md"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                  data-testid="onboarding-finish"
                >
                  {upsert.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  C'est parti !
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground mb-1.5">
        {label}
        {required && <span className="text-[#5b54d6] ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function SocialRow({
  icon: Icon,
  label,
  connected,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  connected: boolean;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-br",
          color,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">
          {connected ? "Connecté et prêt à publier" : "Pas encore connecté"}
        </div>
      </div>
      {connected ? (
        <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
          <Check className="w-3.5 h-3.5" />
          Connecté
        </div>
      ) : (
        <div className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1">
          À configurer
        </div>
      )}
    </div>
  );
}
