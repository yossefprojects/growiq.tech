import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  Rocket,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Facebook,
  Instagram,
  Calendar,
  Target,
  TrendingUp,
  Lightbulb,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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

interface AgencyPlan {
  audienceSummary: string;
  targetingNarrative: string;
  budgetNarrative: string;
  estimatedResults: { impressions: string; clicks: string; conversions: string };
  posts: PlannedPost[];
  recommendations: string[];
}

interface AgencyCampaign {
  id: number;
  name: string;
  status: "draft" | "launched";
  brief: AgencyBrief;
  plan: AgencyPlan;
  notificationEmail: string | null;
  launchedAt: string | null;
  createdAt: string;
}

type Step = "form" | "loading" | "preview" | "success" | "dashboard";

const API = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

const OBJECTIVES = [
  { value: "ventes", label: "Ventes / conversions" },
  { value: "notoriete", label: "Notoriété de marque" },
  { value: "trafic", label: "Trafic vers mon site" },
  { value: "engagement", label: "Engagement communauté" },
];

const CHANNELS: { value: Channel; label: string; icon: typeof Facebook }[] = [
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "instagram", label: "Instagram", icon: Instagram },
];

export default function AgencyPage() {
  const [step, setStep] = useState<Step>("form");
  const [campaign, setCampaign] = useState<AgencyCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<AgencyCampaign[]>([]);
  const [brief, setBrief] = useState<AgencyBrief>({
    product: "",
    audience: "",
    budget: "",
    objective: "ventes",
    channels: ["facebook", "instagram"],
  });
  const [notificationEmail, setNotificationEmail] = useState("");
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

  function toggleChannel(c: Channel) {
    setBrief((b) => ({
      ...b,
      channels: b.channels.includes(c) ? b.channels.filter((x) => x !== c) : [...b.channels, c],
    }));
  }

  async function generatePlan() {
    if (!brief.product.trim() || !brief.audience.trim() || !brief.budget.trim()) {
      toast.error("Remplissez tous les champs avant de continuer.");
      return;
    }
    if (brief.channels.length === 0) {
      toast.error("Choisissez au moins un canal.");
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
        const err = await r.json().catch(() => ({ error: "Erreur" }));
        toast.error(err.error ?? "Échec de la génération");
        setStep("form");
        return;
      }
      const created: AgencyCampaign = await r.json();
      setCampaign(created);
      setStep("preview");
    } catch (e) {
      toast.error("Erreur réseau pendant la génération");
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
        const err = await r.json().catch(() => ({ error: "Erreur" }));
        toast.error(err.error ?? "Échec du lancement");
        return;
      }
      const data = await r.json();
      setCampaign(data.campaign);
      await loadCampaigns();
      setStep("success");
      toast.success("Campagne lancée !");
    } catch {
      toast.error("Erreur réseau pendant le lancement");
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
    setBrief({
      product: "",
      audience: "",
      budget: "",
      objective: "ventes",
      channels: ["facebook", "instagram"],
    });
    setStep("form");
  }

  async function deleteCampaign(id: number) {
    if (!confirm("Supprimer cette campagne ? (Les posts déjà programmés restent.)")) return;
    await fetch(API(`/agency/${id}`), { method: "DELETE" });
    await loadCampaigns();
    toast.success("Campagne supprimée");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour au chat
          </Link>
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Agence automatique
          </div>
          <div className="flex gap-2">
            {step !== "dashboard" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("dashboard")}>
                Mes campagnes ({campaigns.length})
              </Button>
            )}
            {step !== "form" && (
              <Button variant="ghost" size="sm" onClick={resetForNew}>
                Nouvelle
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {step === "form" && <BriefForm brief={brief} setBrief={setBrief} toggleChannel={toggleChannel} onSubmit={generatePlan} loading={loading} />}
        {step === "loading" && <LoadingScreen />}
        {step === "preview" && campaign && (
          <PreviewScreen
            campaign={campaign}
            notificationEmail={notificationEmail}
            setNotificationEmail={setNotificationEmail}
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

function BriefForm({
  brief,
  setBrief,
  toggleChannel,
  onSubmit,
  loading,
}: {
  brief: AgencyBrief;
  setBrief: (b: AgencyBrief) => void;
  toggleChannel: (c: Channel) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Décrivez votre besoin en 5 questions</h1>
        <p className="text-muted-foreground">Notre agent rédige les annonces, génère les visuels et planifie tout pour vous.</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="product">1. Quel est votre produit ou service ?</Label>
          <Textarea
            id="product"
            data-testid="input-product"
            placeholder="Ex : Une boutique en ligne de bijoux artisanaux en argent recyclé, livrés en France."
            value={brief.product}
            onChange={(e) => setBrief({ ...brief, product: e.target.value })}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience">2. Qui est votre cible ? (âge, lieu, intérêts)</Label>
          <Textarea
            id="audience"
            data-testid="input-audience"
            placeholder="Ex : Femmes 25-45 ans, urbaines, sensibles à l'éthique et à l'artisanat français."
            value={brief.audience}
            onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget">3. Quel est votre budget ?</Label>
            <Input
              id="budget"
              data-testid="input-budget"
              placeholder="Ex : 200€"
              value={brief.budget}
              onChange={(e) => setBrief({ ...brief, budget: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objective">4. Quel objectif ?</Label>
            <select
              id="objective"
              data-testid="select-objective"
              value={brief.objective}
              onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>5. Sur quels canaux ?</Label>
          <div className="flex gap-2 flex-wrap">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              const active = brief.channels.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  data-testid={`channel-${c.value}`}
                  onClick={() => toggleChannel(c.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition ${active ? "border-purple-600 bg-purple-50 text-purple-900" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  <Icon className="w-4 h-4" /> {c.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Pour l'instant, seuls Facebook et Instagram (posts gratuits) sont supportés. Google Ads et les pubs payantes arrivent en Phase 2.
          </p>
        </div>

        <Button
          onClick={onSubmit}
          disabled={loading}
          data-testid="button-generate"
          className="w-full h-11 text-base bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Générer ma campagne</>}
        </Button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  const messages = [
    "Analyse de votre brief…",
    "Rédaction des textes d'annonces…",
    "Génération des visuels avec l'IA…",
    "Préparation du calendrier de publication…",
    "Estimation des résultats attendus…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, messages.length - 1)), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-purple-500/40">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-purple-300 animate-ping opacity-30" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">L'agence travaille…</h2>
        <p className="text-muted-foreground transition-all">{messages[idx]}</p>
        <p className="text-xs text-muted-foreground pt-4">Cela prend environ 30 à 60 secondes.</p>
      </div>
    </div>
  );
}

function PreviewScreen({
  campaign,
  notificationEmail,
  setNotificationEmail,
  editPostCopy,
  editPostDate,
  onLaunch,
  onBack,
  loading,
}: {
  campaign: AgencyCampaign;
  notificationEmail: string;
  setNotificationEmail: (v: string) => void;
  editPostCopy: (id: string, copy: string) => void;
  editPostDate: (id: string, date: string) => void;
  onLaunch: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const launched = campaign.status === "launched";
  const { plan } = campaign;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Votre campagne est prête</h1>
        <p className="text-muted-foreground">Vérifiez, modifiez si besoin, puis lancez la publication automatique.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <SummaryCard icon={Target} title="Audience" body={plan.audienceSummary} />
        <SummaryCard icon={TrendingUp} title="Résultats estimés" body={`${plan.estimatedResults.impressions} vues\n${plan.estimatedResults.clicks} clics\n${plan.estimatedResults.conversions} conversions`} />
        <SummaryCard icon={Calendar} title="Calendrier" body={`${plan.posts.length} publications sur 7 jours`} />
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-purple-600" /> Stratégie de ciblage</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{plan.targetingNarrative}</p>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-600" /> Répartition du budget</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{plan.budgetNarrative}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">Aperçu des publications ({plan.posts.length})</h2>
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
          <h3 className="font-semibold flex items-center gap-2 text-amber-900"><Lightbulb className="w-4 h-4" /> Recommandations</h3>
          <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
            {plan.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {!launched && (
        <div className="bg-white rounded-xl border p-5 space-y-4 sticky bottom-4 shadow-lg">
          <div className="space-y-2">
            <Label htmlFor="email">Email pour le récapitulatif (facultatif)</Label>
            <Input id="email" type="email" placeholder="vous@exemple.fr" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} data-testid="input-email" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} disabled={loading} className="flex-1">Modifier le brief</Button>
            <Button onClick={onLaunch} disabled={loading} data-testid="button-launch" className="flex-1 h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Rocket className="w-5 h-5 mr-2" /> Valider et lancer</>}
            </Button>
          </div>
        </div>
      )}

      {launched && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Campagne lancée le {new Date(campaign.launchedAt!).toLocaleString("fr-FR")}</p>
            <p className="text-sm text-green-800">Les publications sont programmées et seront envoyées automatiquement.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, title, body }: { icon: typeof Target; title: string; body: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Icon className="w-4 h-4" /> {title}</div>
      <p className="text-sm whitespace-pre-line">{body}</p>
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
  const isoForInput = (() => {
    const d = new Date(post.scheduledFor);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  return (
    <div className="bg-white rounded-xl border overflow-hidden flex flex-col">
      <div className="aspect-square bg-slate-100 relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Post ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Image indisponible</div>
        )}
        <Badge className="absolute top-3 left-3 gap-1" variant="secondary">
          <Icon className="w-3 h-3" /> {post.channel === "facebook" ? "Facebook" : "Instagram"}
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
    <div className="text-center py-16 space-y-6">
      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/40">
        <CheckCircle2 className="w-12 h-12 text-white" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Votre campagne est en route</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {campaign.plan.posts.length} publications ont été programmées sur Facebook et Instagram. Le système les enverra automatiquement aux horaires prévus.
        </p>
        {campaign.notificationEmail && (
          <p className="text-sm text-muted-foreground">Un récapitulatif a été envoyé à {campaign.notificationEmail}.</p>
        )}
      </div>
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onDashboard}>Voir le tableau de bord</Button>
        <Button onClick={onNew} className="bg-gradient-to-r from-purple-600 to-fuchsia-600">Lancer une autre campagne</Button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes campagnes</h1>
          <p className="text-muted-foreground">{campaigns.length} campagne{campaigns.length > 1 ? "s" : ""} créée{campaigns.length > 1 ? "s" : ""}.</p>
        </div>
        <Button onClick={onNew} className="bg-gradient-to-r from-purple-600 to-fuchsia-600">
          <Sparkles className="w-4 h-4 mr-2" /> Nouvelle campagne
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <p className="text-muted-foreground mb-4">Aucune campagne pour l'instant.</p>
          <Button onClick={onNew}>Créer la première</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4 hover:shadow-md transition" data-testid={`campaign-${c.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <Badge variant={c.status === "launched" ? "default" : "secondary"}>
                    {c.status === "launched" ? "Lancée" : "Brouillon"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.plan.posts.length} publications · créée le {new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
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
