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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-purple-50">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Ton assistant marketing
          </div>
          <div className="flex gap-2">
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
        {step === "success" && campaign && <SuccessScreen campaign={campaign} onNew={resetForNew} onDashboard={() => setStep("dashboard")} />}
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
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/30">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Réponds à 3 petites questions ✨</h1>
        <p className="text-muted-foreground text-lg">Je m'occupe du reste : j'écris tes messages, je crée les images et je les publie tout seul.</p>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="product" className="text-base font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">1</span>
            Qu'est-ce que tu proposes ?
          </Label>
          <Textarea
            id="product"
            data-testid="input-product"
            placeholder="Ex : Je vends des bougies parfumées faites à la main, dans ma boutique à Lyon et en ligne."
            value={brief.product}
            onChange={(e) => setBrief({ ...brief, product: e.target.value })}
            rows={2}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground pl-9">💡 Dis-le avec tes mots, comme si tu en parlais à un ami.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience" className="text-base font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">2</span>
            Qui veux-tu toucher ?
          </Label>
          <Textarea
            id="audience"
            data-testid="input-audience"
            placeholder="Ex : Des femmes entre 30 et 50 ans qui aiment leur intérieur et les choses bien faites."
            value={brief.audience}
            onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
            rows={2}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground pl-9">💡 Pense âge approximatif, ce qu'ils aiment, où ils habitent.</p>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">3</span>
            Qu'est-ce que tu veux obtenir ?
          </Label>
          <div className="grid sm:grid-cols-3 gap-3">
            {OBJECTIVES.map((o) => {
              const Icon = o.icon;
              const active = brief.objective === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  data-testid={`objective-${o.value.replace(/\s/g, "-")}`}
                  onClick={() => setBrief({ ...brief, objective: o.value })}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${active ? "border-purple-600 bg-purple-50 shadow-md scale-[1.02]" : "border-slate-200 hover:border-slate-300 bg-white"}`}
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
        </div>

        <Button
          onClick={onSubmit}
          disabled={loading}
          data-testid="button-generate"
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 shadow-lg shadow-purple-500/30"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Wand2 className="w-6 h-6 mr-2" /> C'est parti !</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          🎁 C'est entièrement gratuit. On publie sur Facebook et Instagram, pas de carte bancaire demandée.
        </p>
      </div>
    </div>
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
          <h1 className="text-3xl font-bold tracking-tight">Voilà ce que j'ai préparé 🎉</h1>
          <p className="text-muted-foreground">Regarde, modifie si tu veux, puis appuie sur le gros bouton vert.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-2 shadow-sm">
          <HelpCircle className="w-4 h-4 text-purple-600" />
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
  const Icon = post.channel === "facebook" ? Facebook : Instagram;
  const channelName = post.channel === "facebook" ? "Facebook" : "Instagram";
  const isoForInput = (() => {
    const d = new Date(post.scheduledFor);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  return (
    <div className="bg-white rounded-2xl border overflow-hidden flex flex-col shadow-sm hover:shadow-md transition">
      <div className="aspect-square bg-slate-100 relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Message ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <Heart className="w-8 h-8" />
            Image en cours…
          </div>
        )}
        <Badge className="absolute top-3 left-3 gap-1 bg-white text-slate-700 hover:bg-white">
          <Icon className="w-3 h-3" /> {channelName}
        </Badge>
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {editable ? (
          <Textarea value={post.copy} onChange={(e) => onCopyChange(e.target.value)} rows={4} className="text-sm" />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{post.copy}</p>
        )}
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-auto">
          <Calendar className="w-3 h-3" />
          {editable ? (
            <input
              type="datetime-local"
              value={isoForInput}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            />
          ) : (
            <span>{new Date(post.scheduledFor).toLocaleString("fr-FR")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({ campaign, onNew, onDashboard }: { campaign: AgencyCampaign; onNew: () => void; onDashboard: () => void }) {
  return (
    <div className="text-center py-16 space-y-8">
      <div className="relative inline-block">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/40 mx-auto">
          <span className="text-6xl">🎉</span>
        </div>
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">C'est parti !</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          J'ai programmé {campaign.plan.posts.length} messages. Ils partiront tout seuls aux dates prévues. Tu n'as plus rien à faire 😊
        </p>
        {campaign.notificationEmail && (
          <p className="text-sm text-muted-foreground">📧 Je t'ai envoyé un récap par email.</p>
        )}
      </div>
      <div className="flex justify-center gap-3 pt-2 flex-wrap">
        <Button variant="outline" onClick={onDashboard} className="h-11">Voir mes campagnes</Button>
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-purple-600 to-fuchsia-600">
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
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-purple-600 to-fuchsia-600">
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
