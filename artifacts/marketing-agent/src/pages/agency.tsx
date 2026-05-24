import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Facebook,
  Instagram,
  Calendar,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ThumbsUp,
  Share2,
  ShoppingBag,
  Megaphone,
  MousePointerClick,
  Lightbulb,
  Trash2,
  Eye,
  HelpCircle,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type Channel = "facebook" | "instagram";

interface AgencyBrief {
  product: string;
  audience: string;
  budget: string;
  objective: string;
  channels: Channel[];
}

interface PlannedPost {
  id: string;
  channel: Channel;
  scheduledFor: string;
  copy: string;
  imagePrompt: string;
  imageUrl?: string;
  scheduledPostId?: number;
}

interface AgencyDecision {
  what: string;
  why: string;
}

interface AgencyPlan {
  audienceSummary: string;
  targetingNarrative: string;
  budgetNarrative: string;
  estimatedResults: { impressions: string; clicks: string; conversions: string };
  posts: PlannedPost[];
  recommendations: string[];
  decisions?: AgencyDecision[];
}

interface AgencyCampaign {
  id: number;
  name: string;
  status: "draft" | "launched" | "launching";
  brief: AgencyBrief;
  plan: AgencyPlan;
  notificationEmail: string | null;
  launchedAt: string | null;
  createdAt: string;
}

type Step = "form" | "loading" | "preview" | "success" | "dashboard";

const API = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

const OBJECTIVES = [
  { value: "vendre", label: "Vendre 🛍️", description: "Tu veux que des gens achètent ton produit ou service", icon: ShoppingBag, color: "from-emerald-500 to-green-600" },
  { value: "te faire connaître", label: "Te faire connaître 📣", description: "Tu veux que plus de gens connaissent ton nom", icon: Megaphone, color: "from-purple-500 to-fuchsia-600" },
  { value: "amener du monde sur ton site", label: "Amener du monde sur ton site 🌐", description: "Tu veux que les gens visitent ton site web", icon: MousePointerClick, color: "from-blue-500 to-indigo-600" },
];

export default function AgencyPage() {
  const [step, setStep] = useState<Step>("form");
  const [campaign, setCampaign] = useState<AgencyCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<AgencyCampaign[]>([]);
  const [brief, setBrief] = useState<AgencyBrief>({
    product: "",
    audience: "",
    budget: "",
    objective: "",
    channels: [],
  });
  const [notificationEmail, setNotificationEmail] = useState("");
  const [explainMode, setExplainMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string } | null>(null);

  useEffect(() => {
    void loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      const r = await fetch(API("/agency"));
      if (r.ok) setCampaigns(await r.json());
    } catch {
      /* silent */
    }
  }

  async function generatePlan() {
    if (!brief.product.trim()) {
      toast.error("Dis-moi d'abord ce que tu proposes 🙂");
      return;
    }
    if (!brief.audience.trim()) {
      toast.error("Dis-moi à qui tu veux parler 🙂");
      return;
    }
    if (!brief.objective) {
      toast.error("Choisis ce que tu veux obtenir 🎯");
      return;
    }
    setLoading(true);
    setStep("loading");
    try {
      const r = await fetch(API("/agency/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Oups" }));
        toast.error(friendlyError(err.error));
        setStep("form");
        return;
      }
      const created: AgencyCampaign = await r.json();
      setCampaign(created);
      setStep("preview");
    } catch {
      toast.error("La connexion a coupé. On réessaie ?");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  async function launchCampaign() {
    if (!campaign) return;
    setLoading(true);
    try {
      const r = await fetch(API(`/agency/${campaign.id}/launch`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: campaign.plan,
          notificationEmail: notificationEmail.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Oups" }));
        toast.error(friendlyError(err.error));
        return;
      }
      const data = await r.json();
      setCampaign(data.campaign);
      setEmailStatus(data.emailStatus ?? null);
      await loadCampaigns();
      setStep("success");
      toast.success("C'est parti ! 🚀");
    } catch {
      toast.error("La connexion a coupé. On réessaie ?");
    } finally {
      setLoading(false);
    }
  }

  function editPostCopy(postId: string, newCopy: string) {
    if (!campaign) return;
    setCampaign({
      ...campaign,
      plan: {
        ...campaign.plan,
        posts: campaign.plan.posts.map((p) => (p.id === postId ? { ...p, copy: newCopy } : p)),
      },
    });
  }

  function editPostDate(postId: string, newDate: string) {
    if (!campaign) return;
    setCampaign({
      ...campaign,
      plan: {
        ...campaign.plan,
        posts: campaign.plan.posts.map((p) =>
          p.id === postId ? { ...p, scheduledFor: new Date(newDate).toISOString() } : p
        ),
      },
    });
  }

  function resetForNew() {
    setCampaign(null);
    setNotificationEmail("");
    setBrief({ product: "", audience: "", budget: "", objective: "", channels: [] });
    setStep("form");
  }

  async function deleteCampaign(id: number) {
    if (!confirm("Tu veux vraiment supprimer cette campagne ? Les messages déjà programmés resteront.")) return;
    await fetch(API(`/agency/${id}`), { method: "DELETE" });
    await loadCampaigns();
    toast.success("Supprimée");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50">
      <header className="border-b border-violet-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour</span>
          </Link>
          <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-home">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">
                GrowIQ
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:block">
                Ton assistant marketing
              </div>
            </div>
          </Link>
          <div className="flex gap-2 shrink-0">
            {step !== "dashboard" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("dashboard")} data-testid="link-dashboard">
                Mes campagnes ({campaigns.length})
              </Button>
            )}
            {step !== "form" && step !== "loading" && (
              <Button variant="ghost" size="sm" onClick={resetForNew}>
                Nouvelle
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {step === "form" && <BriefForm brief={brief} setBrief={setBrief} onSubmit={generatePlan} loading={loading} />}
        {step === "loading" && <LoadingScreen />}
        {step === "preview" && campaign && (
          <PreviewScreen
            campaign={campaign}
            notificationEmail={notificationEmail}
            setNotificationEmail={setNotificationEmail}
            explainMode={explainMode}
            setExplainMode={setExplainMode}
            editPostCopy={editPostCopy}
            editPostDate={editPostDate}
            onLaunch={launchCampaign}
            onBack={() => setStep("form")}
            loading={loading}
          />
        )}
        {step === "success" && campaign && <SuccessScreen campaign={campaign} emailStatus={emailStatus} onNew={resetForNew} onDashboard={() => setStep("dashboard")} />}
        {step === "dashboard" && <Dashboard campaigns={campaigns} onView={(c) => { setCampaign(c); setStep("preview"); }} onDelete={deleteCampaign} onNew={resetForNew} />}
      </main>
    </div>
  );
}

function friendlyError(err: string | undefined): string {
  if (!err) return "Oups, ça n'a pas marché. On réessaie ?";
  if (err.includes("Trop de g")) return "Tu as déjà créé beaucoup de campagnes aujourd'hui. Reviens dans une heure 🙂";
  if (err.toLowerCase().includes("réponds")) return err;
  if (err.toLowerCase().includes("vide")) return "Il manque une réponse. Vérifie les 3 questions.";
  if (err.includes("Cette campagne a déjà été lancée") || err.includes("déjà en cours")) {
    return "Cette campagne a déjà été lancée 🎉";
  }
  return "Quelque chose n'a pas marché de notre côté. Réessaie dans un instant.";
}

const PRODUCT_EXAMPLES = [
  { emoji: "🍕", label: "Restaurant", text: "Je tiens un restaurant italien dans le centre-ville, avec terrasse et menu du midi." },
  { emoji: "👗", label: "Boutique en ligne", text: "Je vends des vêtements pour femmes faits par des créateurs français, sur ma boutique en ligne." },
  { emoji: "💪", label: "Coach sportif", text: "Je suis coach sportif et je propose des séances en visio et à domicile." },
  { emoji: "🕯️", label: "Artisanat", text: "Je fabrique des bougies parfumées à la main que je vends en boutique et en ligne." },
  { emoji: "💇", label: "Salon de beauté", text: "Je tiens un salon de coiffure et soins esthétiques de quartier." },
];

const AUDIENCE_EXAMPLES = [
  { emoji: "👩", label: "Femmes 30-50 ans", text: "Des femmes entre 30 et 50 ans qui aiment leur intérieur et les belles choses." },
  { emoji: "🧑‍💼", label: "Jeunes actifs", text: "Des jeunes actifs de 25-35 ans qui habitent en ville et sortent souvent." },
  { emoji: "👨‍👩‍👧", label: "Familles du coin", text: "Des familles avec enfants qui habitent à moins de 30 minutes." },
  { emoji: "👵", label: "Seniors", text: "Des personnes de 60 ans et plus qui aiment prendre soin d'elles." },
  { emoji: "🎓", label: "Étudiants", text: "Des étudiants entre 18 et 25 ans avec un petit budget." },
];

const ENCOURAGEMENTS = [
  "Super ! 🎉",
  "Génial, on y est presque ! 😊",
  "Parfait, c'est tout bon ! ✨",
];

function BriefForm({
  brief,
  setBrief,
  onSubmit,
  loading,
}: {
  brief: AgencyBrief;
  setBrief: (b: AgencyBrief) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [showEncouragement, setShowEncouragement] = useState<string | null>(null);

  const totalSteps = 3;

  function nextStep(encouragement: string) {
    setShowEncouragement(encouragement);
    setTimeout(() => {
      setShowEncouragement(null);
      setStep((s) => Math.min(s + 1, totalSteps - 1));
      setAnimKey((k) => k + 1);
    }, 900);
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
    setAnimKey((k) => k + 1);
  }

  const canProductNext = brief.product.trim().length >= 8;
  const canAudienceNext = brief.audience.trim().length >= 8;

  const progressPercent = ((step + 1) / totalSteps) * 100;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-500/40 animate-pop-in">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">On fait connaissance ? ✨</h1>
        <p className="text-muted-foreground text-lg">Une petite question à la fois, c'est promis 🙂</p>
      </div>

      <div className="max-w-md mx-auto space-y-2" aria-label="progression">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-violet-700">Étape {step + 1} sur {totalSteps}</span>
          <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-blue-600 rounded-full transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {showEncouragement ? (
        <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-300" data-testid="encouragement">
          <div className="text-6xl mb-3 animate-bounce">🎉</div>
          <p className="text-2xl font-bold bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">{showEncouragement}</p>
        </div>
      ) : (
        <div
          key={animKey}
          className="bg-white rounded-2xl border shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"
        >
          {step === 0 && (
            <StepProduct
              value={brief.product}
              setValue={(v) => setBrief({ ...brief, product: v })}
              canNext={canProductNext}
              onNext={() => nextStep(ENCOURAGEMENTS[0])}
            />
          )}
          {step === 1 && (
            <StepAudience
              value={brief.audience}
              setValue={(v) => setBrief({ ...brief, audience: v })}
              canNext={canAudienceNext}
              onNext={() => nextStep(ENCOURAGEMENTS[1])}
              onBack={prevStep}
            />
          )}
          {step === 2 && (
            <StepObjective
              value={brief.objective}
              setValue={(v) => setBrief({ ...brief, objective: v })}
              onSubmit={onSubmit}
              onBack={prevStep}
              loading={loading}
            />
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        🎁 C'est entièrement gratuit. On publie sur Facebook et Instagram, pas de carte bancaire demandée.
      </p>
    </div>
  );
}

function StepProduct({
  value,
  setValue,
  canNext,
  onNext,
}: {
  value: string;
  setValue: (v: string) => void;
  canNext: boolean;
  onNext: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Question 1 sur 3</div>
        <h2 className="text-2xl font-bold">Tu proposes quoi ? 🤔</h2>
        <p className="text-muted-foreground text-sm">Dis-le avec tes mots, comme si tu en parlais à un ami.</p>
      </div>
      <Textarea
        data-testid="input-product"
        placeholder="Ex : Je vends des bougies parfumées faites à la main, dans ma boutique à Lyon et en ligne."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="text-base"
        autoFocus
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">💡 Pas d'idée ? Clique sur un exemple :</p>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setValue(ex.text)}
              className="px-3 py-2 rounded-full border bg-white hover:bg-violet-50 hover:border-violet-300 text-sm transition-all hover:scale-105"
              data-testid={`example-product-${ex.label}`}
            >
              {ex.emoji} {ex.label}
            </button>
          ))}
        </div>
      </div>
      <Button
        onClick={onNext}
        disabled={!canNext}
        data-testid="button-next-1"
        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
      >
        Continuer →
      </Button>
    </>
  );
}

function StepAudience({
  value,
  setValue,
  canNext,
  onNext,
  onBack,
}: {
  value: string;
  setValue: (v: string) => void;
  canNext: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Question 2 sur 3</div>
        <h2 className="text-2xl font-bold">À qui tu veux parler ? 👥</h2>
        <p className="text-muted-foreground text-sm">Décris les gens que tu aimerais avoir comme clients : âge, ce qu'ils aiment, où ils habitent.</p>
      </div>
      <Textarea
        data-testid="input-audience"
        placeholder="Ex : Des femmes entre 30 et 50 ans qui aiment leur intérieur et les choses bien faites."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="text-base"
        autoFocus
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">💡 Pas d'idée ? Clique sur un exemple :</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setValue(ex.text)}
              className="px-3 py-2 rounded-full border bg-white hover:bg-violet-50 hover:border-violet-300 text-sm transition-all hover:scale-105"
              data-testid={`example-audience-${ex.label}`}
            >
              {ex.emoji} {ex.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-14 px-6">
          ←
        </Button>
        <Button
          onClick={onNext}
          disabled={!canNext}
          data-testid="button-next-2"
          className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
        >
          Continuer →
        </Button>
      </div>
    </>
  );
}

function StepObjective({
  value,
  setValue,
  onSubmit,
  onBack,
  loading,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Question 3 sur 3 — la dernière !</div>
        <h2 className="text-2xl font-bold">Qu'est-ce que tu veux obtenir ? 🎯</h2>
        <p className="text-muted-foreground text-sm">Choisis ce qui compte le plus pour toi en ce moment.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {OBJECTIVES.map((o) => {
          const Icon = o.icon;
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              data-testid={`objective-${o.value.replace(/\s/g, "-")}`}
              onClick={() => setValue(o.value)}
              className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                active ? "border-violet-600 bg-violet-50 shadow-md scale-[1.02]" : "border-slate-200 hover:border-violet-300 bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${o.color} flex items-center justify-center mb-2 shadow-sm`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="font-semibold text-sm">{o.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{o.description}</div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={loading} className="h-16 px-6">
          ←
        </Button>
        <Button
          onClick={onSubmit}
          disabled={loading || !value}
          data-testid="button-generate"
          className="flex-1 h-16 text-xl font-bold bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-orange-700 hover:to-red-600 shadow-xl shadow-orange-500/50 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Wand2 className="w-6 h-6 mr-2" /> Créer ma campagne 🚀
            </>
          )}
        </Button>
      </div>
    </>
  );
}

function LoadingScreen() {
  const messages = [
    "Je lis tes réponses… 📖",
    "J'écris des messages qui parlent à tes clients… ✍️",
    "Je dessine de jolies images pour toi… 🎨",
    "Je choisis les meilleurs horaires pour publier… ⏰",
    "Je calcule ce que ça pourrait te rapporter… 📊",
    "Plus que quelques secondes… ⏳",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, messages.length - 1)), 8000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-purple-500/40">
          <Wand2 className="w-12 h-12 text-white animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-purple-300 animate-ping opacity-30" />
      </div>
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold">Je travaille pour toi…</h2>
        <p className="text-muted-foreground text-lg transition-all min-h-[28px]">{messages[idx]}</p>
        <p className="text-sm text-muted-foreground pt-6 max-w-md mx-auto">
          ☕ C'est le bon moment pour aller te chercher un café. Ça prend environ une minute.
        </p>
      </div>
    </div>
  );
}

function PreviewScreen({
  campaign,
  notificationEmail,
  setNotificationEmail,
  explainMode,
  setExplainMode,
  editPostCopy,
  editPostDate,
  onLaunch,
  onBack,
  loading,
}: {
  campaign: AgencyCampaign;
  notificationEmail: string;
  setNotificationEmail: (v: string) => void;
  explainMode: boolean;
  setExplainMode: (v: boolean) => void;
  editPostCopy: (id: string, copy: string) => void;
  editPostDate: (id: string, date: string) => void;
  onLaunch: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const launched = campaign.status === "launched";
  const { plan } = campaign;
  const channelsUsed = Array.from(new Set(plan.posts.map((p) => p.channel)));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">Voilà ce que j'ai préparé 🎉</h1>
          <p className="text-muted-foreground">Regarde, modifie si tu veux, puis appuie sur le gros bouton vert.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-2 shadow-sm">
          <HelpCircle className="w-4 h-4 text-violet-600" />
          <Label htmlFor="explain" className="text-sm cursor-pointer">Explique-moi tout</Label>
          <Switch id="explain" checked={explainMode} onCheckedChange={setExplainMode} data-testid="switch-explain" />
        </div>
      </div>

      {explainMode && (
        <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border-2 border-purple-200 rounded-2xl p-6 space-y-3" data-testid="explain-box">
          <h3 className="font-bold text-lg flex items-center gap-2 text-purple-900">
            <Lightbulb className="w-5 h-5" /> Mes choix, expliqués comme à un enfant
          </h3>
          {plan.decisions && plan.decisions.length > 0 ? (
            <ul className="space-y-3">
              {plan.decisions.map((d, i) => (
                <li key={i} className="bg-white/70 rounded-lg p-3">
                  <div className="font-semibold text-purple-900 text-sm">✓ {d.what}</div>
                  <div className="text-sm text-slate-700 mt-1">→ {d.why}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-purple-900 bg-white/70 rounded-lg p-3">
              😊 Cette campagne a été créée avant cette nouveauté, donc je n'ai pas gardé le détail de mes choix. Pour les prochaines, tu verras ici tout ce que j'ai décidé et pourquoi.
            </p>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <FriendlyCard emoji="👥" title="Pour qui je travaille" body={plan.audienceSummary} />
        <FriendlyCard
          emoji="📊"
          title="Ce que ça pourrait donner"
          body={`${plan.estimatedResults.impressions}\n${plan.estimatedResults.clicks}\n${plan.estimatedResults.conversions}`}
        />
        <FriendlyCard
          emoji="📅"
          title="Quand on publie"
          body={`${plan.posts.length} messages sur 7 jours\nsur ${channelsUsed.map((c) => c === "facebook" ? "Facebook" : "Instagram").join(" et ")}`}
        />
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">🎯 Comment je vais les trouver</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{plan.targetingNarrative}</p>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">💰 Côté argent</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{plan.budgetNarrative}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">📬 Tes messages prêts à partir ({plan.posts.length})</h2>
        <p className="text-sm text-muted-foreground">Tu peux modifier le texte ou la date en cliquant dessus.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {plan.posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i + 1}
              editable={!launched}
              onCopyChange={(c) => editPostCopy(post.id, c)}
              onDateChange={(d) => editPostDate(post.id, d)}
            />
          ))}
        </div>
      </div>

      {plan.recommendations?.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 space-y-2">
          <h3 className="font-bold flex items-center gap-2 text-amber-900">
            <Lightbulb className="w-5 h-5" /> Mes petits conseils en plus
          </h3>
          <ul className="text-sm text-amber-900 space-y-2">
            {plan.recommendations.map((r, i) => <li key={i}>✨ {r}</li>)}
          </ul>
        </div>
      )}

      {!launched && (
        <div className="bg-white rounded-2xl border-2 border-purple-100 p-5 space-y-4 sticky bottom-4 shadow-xl">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-semibold">📧 Ton email (facultatif)</Label>
            <input
              id="email"
              type="email"
              placeholder="pour qu'on te confirme par email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              data-testid="input-email"
              className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} disabled={loading} className="flex-1 h-12">
              ← Refaire les réponses
            </Button>
            <Button
              onClick={onLaunch}
              disabled={loading}
              data-testid="button-launch"
              className="flex-[2] h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>🚀 Lancer</>}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            ✅ Une fois lancé, je publie tout seul aux horaires prévus. Tu n'as plus rien à faire.
          </p>
        </div>
      )}

      {launched && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
          <div>
            <p className="font-bold text-green-900">Campagne lancée le {new Date(campaign.launchedAt!).toLocaleString("fr-FR")} ✨</p>
            <p className="text-sm text-green-800">Les messages partiront tout seuls aux dates prévues. Profite de ta journée !</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FriendlyCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-2xl">{emoji}</span> {title}
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{body}</p>
    </div>
  );
}

function PostCard({
  post,
  index,
  editable,
  onCopyChange,
  onDateChange,
}: {
  post: PlannedPost;
  index: number;
  editable: boolean;
  onCopyChange: (c: string) => void;
  onDateChange: (d: string) => void;
}) {
  const isoForInput = (() => {
    const d = new Date(post.scheduledFor);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const dateLabel = new Date(post.scheduledFor).toLocaleString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-slate-50 rounded-2xl border overflow-hidden flex flex-col shadow-sm hover:shadow-md transition">
      {post.channel === "instagram" ? (
        <InstagramMockup post={post} index={index} />
      ) : (
        <FacebookMockup post={post} index={index} />
      )}

      <div className="p-4 space-y-3 bg-white border-t">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
          ✏️ Modifie si tu veux
        </div>
        {editable ? (
          <Textarea
            value={post.copy}
            onChange={(e) => onCopyChange(e.target.value)}
            rows={3}
            className="text-sm"
            data-testid={`post-copy-${post.id}`}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{post.copy}</p>
        )}
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          {editable ? (
            <input
              type="datetime-local"
              value={isoForInput}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            />
          ) : (
            <span>{dateLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function InstagramMockup({ post, index }: { post: PlannedPost; index: number }) {
  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-bold">
              T
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold">ta_marque</div>
            <div className="text-[10px] text-slate-500">Sponsorisé</div>
          </div>
        </div>
        <MoreHorizontal className="w-4 h-4 text-slate-700" />
      </div>
      <div className="aspect-square bg-slate-100 relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Post ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <Instagram className="w-8 h-8" />
            Image en cours…
          </div>
        )}
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-slate-800" />
            <MessageCircle className="w-5 h-5 text-slate-800" />
            <Send className="w-5 h-5 text-slate-800" />
          </div>
          <Bookmark className="w-5 h-5 text-slate-800" />
        </div>
        <div className="text-xs font-semibold">{124 + index * 17} mentions J'aime</div>
        <div className="text-xs text-slate-700 line-clamp-2">
          <span className="font-semibold">ta_marque</span>{" "}
          <span>{post.copy.split("\n")[0]}</span>
        </div>
        <div className="text-[10px] text-slate-400 uppercase">Il y a quelques instants</div>
      </div>
    </div>
  );
}

function FacebookMockup({ post, index }: { post: PlannedPost; index: number }) {
  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
            T
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Ta marque</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              Sponsorisé · <span className="text-blue-600">🌐</span>
            </div>
          </div>
        </div>
        <MoreHorizontal className="w-5 h-5 text-slate-600" />
      </div>
      <div className="px-3 pb-2.5 text-sm text-slate-800 whitespace-pre-wrap line-clamp-3">
        {post.copy}
      </div>
      <div className="aspect-[4/3] bg-slate-100 relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Pub ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <Facebook className="w-8 h-8" />
            Image en cours…
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
        <div className="text-[11px] text-slate-600 font-semibold uppercase tracking-wide">
          En savoir plus
        </div>
        <div className="text-[10px] text-slate-500">tamarque.fr</div>
      </div>
      <div className="px-3 py-1.5 flex items-center justify-between text-xs text-slate-600 border-t">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-blue-600 inline-flex items-center justify-center">
            <ThumbsUp className="w-2.5 h-2.5 text-white" />
          </span>
          <span>{286 + index * 23}</span>
        </div>
        <div className="text-[11px] text-slate-500">{34 + index * 3} commentaires · {12 + index} partages</div>
      </div>
      <div className="grid grid-cols-3 border-t text-xs text-slate-600 font-medium">
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50"><ThumbsUp className="w-3.5 h-3.5" /> J'aime</button>
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50"><MessageCircle className="w-3.5 h-3.5" /> Commenter</button>
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50"><Share2 className="w-3.5 h-3.5" /> Partager</button>
      </div>
    </div>
  );
}

const CONFETTI_EMOJIS = ["🎉", "✨", "🎊", "💜", "💙", "🧡", "⭐", "🚀"];

function Confetti() {
  const pieces = Array.from({ length: 40 }).map((_, i) => ({
    emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function SuccessScreen({
  campaign,
  emailStatus,
  onNew,
  onDashboard,
}: {
  campaign: AgencyCampaign;
  emailStatus: { sent: boolean; error?: string } | null;
  onNew: () => void;
  onDashboard: () => void;
}) {
  return (
    <div className="text-center py-16 space-y-8 relative">
      <Confetti />
      <div className="relative inline-block">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/40 mx-auto animate-pop-in">
          <span className="text-6xl">🎉</span>
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-green-300 animate-ping opacity-30" />
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">C'est parti !</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          J'ai programmé {campaign.plan.posts.length} messages. Ils partiront tout seuls aux dates prévues. Tu n'as plus rien à faire 😊
        </p>
        {campaign.notificationEmail && emailStatus?.sent && (
          <p className="text-sm text-green-700">📧 Récap envoyé à {campaign.notificationEmail} (pense à vérifier tes spams).</p>
        )}
        {campaign.notificationEmail && emailStatus && !emailStatus.sent && (
          <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-3 text-left text-sm text-amber-900">
            <p className="font-semibold">📧 L'email récap n'est pas parti.</p>
            <p className="text-xs mt-1">
              Ta campagne, elle, est bien lancée ! Côté email, ça vient probablement de l'adresse expéditeur configurée. Détail technique : {emailStatus.error?.slice(0, 200) || "raison inconnue"}.
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-3 pt-2 flex-wrap">
        <Button variant="outline" onClick={onDashboard} className="h-11">Voir mes campagnes</Button>
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
          <Wand2 className="w-4 h-4 mr-2" /> En lancer une autre
        </Button>
      </div>
    </div>
  );
}

function Dashboard({
  campaigns,
  onView,
  onDelete,
  onNew,
}: {
  campaigns: AgencyCampaign[];
  onView: (c: AgencyCampaign) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mes campagnes 📋</h1>
          <p className="text-muted-foreground">{campaigns.length === 0 ? "Pas encore de campagne" : `${campaigns.length} campagne${campaigns.length > 1 ? "s" : ""} en tout`}</p>
        </div>
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
          <Wand2 className="w-4 h-4 mr-2" /> En lancer une nouvelle
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border">
          <div className="text-5xl mb-3">🌱</div>
          <p className="text-muted-foreground mb-4">Aucune campagne pour l'instant. On commence ?</p>
          <Button onClick={onNew}>Créer ma première campagne</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border p-5 flex items-center justify-between gap-4 hover:shadow-md transition" data-testid={`campaign-${c.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <Badge variant={c.status === "launched" ? "default" : "secondary"} className={c.status === "launched" ? "bg-green-600" : ""}>
                    {c.status === "launched" ? "✅ Lancée" : c.status === "launching" ? "⏳ En cours" : "📝 Brouillon"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.plan.posts.length} messages · créée le {new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => onView(c)}>
                  <Eye className="w-4 h-4 mr-1" /> Voir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(c.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
