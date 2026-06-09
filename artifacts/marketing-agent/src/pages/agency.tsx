import { useState, useEffect, useRef, type ChangeEvent } from "react";
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
  UserPlus,
  Check as CheckIcon,
  Lightbulb,
  Trash2,
  Eye,
  HelpCircle,
  Wand2,
  Linkedin,
  Mail,
  Globe,
  Target,
  Zap,
  Paperclip,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";
import { BrandIcon, BrandWordmark } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/lib/i18n";
import { useConnectedChannels } from "@/hooks/use-connected-channels";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

// Channels élargi pour le formulaire : le backend filtre lui-même et ne garde
// que facebook/instagram aujourd'hui (cf. allowedChannels dans /agency/generate).
// LinkedIn, Meta Ads et Google Ads sont affichés dans l'UI mais ne sont PAS
// encore générés par l'IA — on tombe sur un écran "Bientôt" au submit.
// (Le flux `email` est désormais actif : génération réelle via /email/campaigns/generate.)
type Channel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "meta-ads"
  | "google-ads";

type CampaignType = "social" | "ads" | "email";

type EmailStyle = "vouvoiement" | "tutoiement";

interface AgencyBrief {
  // Type de campagne (UI-only — pas envoyé au backend pour l'instant)
  campaignType?: CampaignType;
  product: string;
  audience: string;
  // Sujet précis du post (UI-only — concaténé au product au submit)
  subject?: string;
  // URL du site (UI-only, ads path — concaténée au product au submit)
  siteUrl?: string;
  budget: string;
  objective: string;
  channels: Channel[];
  // Forme d'adresse de l'email (flow email uniquement). Défaut : vouvoiement.
  emailStyle: EmailStyle;
}

// Les posts planifiés par l'IA : FB / IG / LinkedIn (cf. backend).
type PostChannel = "facebook" | "instagram" | "linkedin";

interface PlannedPost {
  id: string;
  channel: PostChannel;
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

type Step = "form" | "loading" | "preview" | "success" | "dashboard" | "coming-soon" | "email-preview" | "email-success";

interface EmailAttachmentRow {
  filename: string;
  path: string;
  contentType: string;
  size: number;
}

interface EmailCampaignRow {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  attachments?: EmailAttachmentRow[];
}

interface EmailContactRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  subscribed: boolean;
}

const API = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

// ─────────────────────────────────────────────────────────────────────────────
// Constantes du tunnel de création de campagne
//
// Architecture : 2 étapes structurelles
//   1. Choix du type de campagne (3 cartes : Réseaux Sociaux / Ads / Email)
//   2. Formulaire adaptatif (questions différentes selon le type choisi)
//
// État backend : `social` (FB/IG) et `email` génèrent vraiment du contenu
// (email via /email/campaigns/generate). Seul `ads` affiche un écran "Bientôt"
// — pas d'appel serveur. Voir generatePlan.
// ─────────────────────────────────────────────────────────────────────────────

const CAMPAIGN_TYPES = [
  {
    value: "social" as CampaignType,
    label: "Réseaux Sociaux",
    sub: "Gratuit",
    description: "Publie sur tes réseaux sans dépenser un euro. Idéal pour entretenir ta communauté au quotidien.",
    icon: MessageCircle,
    color: "from-violet-500 to-purple-600",
    available: true,
    details: [
      "Posts gratuits sur Facebook, Instagram et LinkedIn",
      "Visuels générés automatiquement par l'IA",
      "5 messages programmés sur 7 jours",
      "Tu valides avant publication, rien n'est envoyé sans ton accord",
    ],
  },
  {
    value: "ads" as CampaignType,
    label: "Publicité Payante",
    sub: "Ads",
    description: "Booste ta visibilité avec un budget publicitaire. Idéal pour vendre vite ou trouver des prospects.",
    icon: Target,
    color: "from-orange-500 to-red-600",
    available: false,
    details: [
      "Campagnes Meta Ads (Facebook + Instagram payants)",
      "Campagnes Google Ads (Recherche)",
      "Ciblage précis selon ton audience",
      "Suivi des coûts et des résultats au quotidien",
    ],
  },
  {
    value: "email" as CampaignType,
    label: "Campagne Emailing",
    sub: "Newsletter",
    description: "Envoie un message direct à tes contacts. Idéal pour fidéliser ou annoncer une nouveauté.",
    icon: Mail,
    color: "from-blue-500 to-cyan-600",
    available: true,
    details: [
      "Email rédigé pour toi selon ton objectif",
      "Envoi à ta base de contacts (à connecter)",
      "Suivi des ouvertures et des clics",
      "Modèles adaptés à ta marque",
    ],
  },
];

// Objectifs par type de campagne. Les `details` sont affichés sous chaque carte
// pour que l'utilisateur non-technique voie EXACTEMENT ce que l'IA va faire.

const OBJECTIVES_SOCIAL = [
  {
    value: "te faire connaître",
    label: "Te faire connaître 📣",
    description: "Tu veux que plus de gens connaissent ton nom",
    icon: Megaphone,
    color: "from-purple-500 to-fuchsia-600",
    details: [
      "Posts qui racontent ton histoire, tes coulisses, tes valeurs",
      "Fréquence de publication élevée pour rester visible",
      "Hashtags larges pour toucher de nouvelles personnes",
    ],
  },
  {
    value: "partager une nouveauté",
    label: "Partager une nouveauté 🎁",
    description: "Tu veux annoncer un produit, une promo, un événement",
    icon: Sparkles,
    color: "from-amber-500 to-orange-600",
    details: [
      "Posts orientés annonce avec visuel marquant",
      "Appel à l'action clair (« Découvre », « Profite »)",
      "Programmation aux heures de forte audience",
    ],
  },
  {
    value: "créer du lien",
    label: "Créer du lien 💬",
    description: "Tu veux que ta communauté interagisse avec toi",
    icon: Heart,
    color: "from-pink-500 to-rose-600",
    details: [
      "Posts questions, sondages, mini-jeux",
      "Ton conversationnel et chaleureux",
      "Réponses suggérées aux commentaires",
    ],
  },
];

const OBJECTIVES_ADS = [
  {
    value: "générer des leads/prospects",
    label: "Générer des leads 🎯",
    description: "Tu veux récolter des contacts qualifiés (emails, téléphones)",
    icon: UserPlus,
    color: "from-orange-500 to-amber-600",
    details: [
      "Création d'une page de capture optimisée pour les inscriptions",
      "Pub Meta/Google ciblée sur tes prospects",
      "Formulaire court pour maximiser les inscriptions",
      "Récap automatique des nouveaux contacts récoltés",
    ],
  },
  {
    value: "vendre un produit",
    label: "Vendre un produit 🛍️",
    description: "Tu veux que des gens achètent ton produit ou service",
    icon: ShoppingBag,
    color: "from-emerald-500 to-green-600",
    details: [
      "Visuels publicitaires orientés vente",
      "Ciblage des acheteurs probables",
      "CTA « Achète maintenant » avec suivi des ventes",
      "Reciblage des visiteurs qui n'ont pas acheté",
    ],
  },
  {
    value: "trafic vers le site",
    label: "Trafic vers le site 🌐",
    description: "Tu veux faire venir du monde sur ton site web",
    icon: MousePointerClick,
    color: "from-blue-500 to-indigo-600",
    details: [
      "Pub Google sur tes mots-clés",
      "Pub Meta orientée clic",
      "Suivi du coût par visite",
      "Optimisation pour maximiser les visites par euro",
    ],
  },
];

const OBJECTIVES_EMAIL = [
  {
    value: "fidéliser mes clients",
    label: "Fidéliser tes clients 💛",
    description: "Garder le lien avec tes clients existants",
    icon: Heart,
    color: "from-rose-500 to-pink-600",
    details: [
      "Email chaleureux et personnalisé",
      "Offres exclusives pour tes clients",
      "Suivi des taux d'ouverture",
    ],
  },
  {
    value: "annoncer une nouveauté",
    label: "Annoncer une nouveauté 🎁",
    description: "Faire connaître un nouveau produit ou un événement",
    icon: Sparkles,
    color: "from-amber-500 to-orange-600",
    details: [
      "Email avec visuel et appel à l'action",
      "Programmation au meilleur moment",
      "Mesure des clics vers ton site",
    ],
  },
  {
    value: "relancer mes prospects",
    label: "Relancer tes prospects 📩",
    description: "Réveiller des contacts inactifs",
    icon: Send,
    color: "from-violet-500 to-purple-600",
    details: [
      "Séquence d'emails de relance",
      "Personnalisation selon l'historique du contact",
      "Désinscription automatique respectée",
    ],
  },
];

// Réseaux disponibles pour le path "social" (publications gratuites).
const SOCIAL_NETWORKS = [
  { value: "facebook" as Channel, label: "Facebook", icon: Facebook, color: "text-[#1877f2]", bg: "bg-[#1877f2]/10", available: true },
  { value: "instagram" as Channel, label: "Instagram", icon: Instagram, color: "text-pink-600", bg: "bg-pink-100", available: true },
  { value: "linkedin" as Channel, label: "LinkedIn", icon: Linkedin, color: "text-[#0a66c2]", bg: "bg-[#0a66c2]/10", available: true },
];

// Réseaux disponibles pour le path "ads".
const ADS_NETWORKS = [
  { value: "meta-ads" as Channel, label: "Meta Ads", desc: "Pub Facebook + Instagram", icon: Facebook, color: "text-[#1877f2]", bg: "bg-[#1877f2]/10" },
  { value: "google-ads" as Channel, label: "Google Ads", desc: "Pub sur Recherche Google", icon: Globe, color: "text-emerald-400", bg: "bg-emerald-500/15" },
];

type ObjectiveOption = (typeof OBJECTIVES_SOCIAL)[number];

export default function AgencyPage() {
  const [step, setStep] = useState<Step>("form");
  const [campaign, setCampaign] = useState<AgencyCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<AgencyCampaign[]>([]);
  const [brief, setBrief] = useState<AgencyBrief>({
    campaignType: undefined,
    product: "",
    audience: "",
    subject: "",
    siteUrl: "",
    budget: "",
    objective: "",
    channels: [],
    emailStyle: "vouvoiement",
  });
  const [notificationEmail, setNotificationEmail] = useState("");
  const [explainMode, setExplainMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string } | null>(null);
  const [emailCampaign, setEmailCampaign] = useState<EmailCampaignRow | null>(null);
  const [emailSendResult, setEmailSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const t = useT();

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
      toast.error(t("Dis-moi d'abord ce que tu proposes 🙂"));
      return;
    }
    if (!brief.audience.trim()) {
      toast.error(t("Dis-moi à qui tu veux parler 🙂"));
      return;
    }
    if (!brief.objective) {
      toast.error(t("Choisis ce que tu veux obtenir 🎯"));
      return;
    }
    // Ads reste sur "Bientôt" (validations Meta/Google externes en cours).
    if (brief.campaignType === "ads") {
      setStep("coming-soon");
      return;
    }
    // Email : nouveau flow — on génère un email via /api/email/campaigns/generate
    // puis on bascule sur l'écran de preview + sélecteur de destinataires.
    if (brief.campaignType === "email") {
      setLoading(true);
      setStep("loading");
      try {
        const r = await fetch(API("/email/campaigns/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: brief.subject?.trim()
              ? `${brief.product.trim()}\n\nSujet : ${brief.subject.trim()}`
              : brief.product,
            audience: brief.audience,
            objective: brief.objective,
            style: brief.emailStyle,
          }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Oups" }));
          toast.error(t(friendlyError(err.error)));
          setStep("form");
          return;
        }
        const created: EmailCampaignRow = await r.json();
        setEmailCampaign(created);
        setStep("email-preview");
      } catch {
        toast.error(t("La connexion a coupé. On réessaie ?"));
        setStep("form");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setStep("loading");
    // Enrichir le product avec le subject pour donner du contexte à l'IA.
    const enrichedProduct = brief.subject?.trim()
      ? `${brief.product.trim()}\n\nSujet précis de cette campagne : ${brief.subject.trim()}`
      : brief.product;
    // Le backend filtre les channels (garde FB/IG uniquement) — on envoie quand même
    // la sélection brute pour qu'il ait la trace, et il choisira lui-même.
    const payload = {
      product: enrichedProduct,
      audience: brief.audience,
      budget: brief.budget,
      objective: brief.objective,
      channels: brief.channels,
    };
    try {
      const r = await fetch(API("/agency/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Oups" }));
        toast.error(t(friendlyError(err.error)));
        setStep("form");
        return;
      }
      const created: AgencyCampaign = await r.json();
      setCampaign(created);
      setStep("preview");
    } catch {
      toast.error(t("La connexion a coupé. On réessaie ?"));
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
        toast.error(t(friendlyError(err.error)));
        return;
      }
      const data = await r.json();
      setCampaign(data.campaign);
      setEmailStatus(data.emailStatus ?? null);
      await loadCampaigns();
      setStep("success");
      toast.success(t("C'est parti ! 🚀"));
    } catch {
      toast.error(t("La connexion a coupé. On réessaie ?"));
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
      campaignType: undefined,
      product: "",
      audience: "",
      subject: "",
      siteUrl: "",
      budget: "",
      objective: "",
      channels: [],
      emailStyle: "vouvoiement",
    });
    setStep("form");
  }

  async function deleteCampaign(id: number) {
    if (!confirm(t("Tu veux vraiment supprimer cette campagne ? Les messages déjà programmés resteront."))) return;
    await fetch(API(`/agency/${id}`), { method: "DELETE" });
    await loadCampaigns();
    toast.success(t("Supprimée"));
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Retour")}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-home">
            <BrandIcon size={36} className="shrink-0 drop-shadow-sm" />
            <div className="leading-tight">
              <BrandWordmark className="text-lg" />
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:block">
                {t("Ton assistant marketing")}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            {step !== "dashboard" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("dashboard")} data-testid="link-dashboard">
                {t("Mes campagnes ({count})", { count: campaigns.length })}
              </Button>
            )}
            {step !== "form" && step !== "loading" && (
              <Button variant="ghost" size="sm" onClick={resetForNew}>
                {t("Nouvelle")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {step === "form" && <BriefForm brief={brief} setBrief={setBrief} onSubmit={generatePlan} loading={loading} />}
        {step === "loading" && <LoadingScreen />}
        {step === "coming-soon" && (
          <ComingSoonScreen
            brief={brief}
            notificationEmail={notificationEmail}
            setNotificationEmail={setNotificationEmail}
            onBack={() => setStep("form")}
            onNew={resetForNew}
          />
        )}
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
        {step === "email-preview" && emailCampaign && (
          <EmailPreviewScreen
            campaign={emailCampaign}
            setCampaign={setEmailCampaign}
            onSent={(result) => {
              setEmailSendResult(result);
              setStep("email-success");
            }}
            onBack={() => setStep("form")}
          />
        )}
        {step === "email-success" && emailCampaign && emailSendResult && (
          <EmailSuccessScreen
            campaign={emailCampaign}
            result={emailSendResult}
            onNew={resetForNew}
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
  if (err.toLowerCase().includes("vide")) return "Il manque une réponse. Vérifie tes choix dans le formulaire.";
  if (err.toLowerCase().includes("invalide")) return "Une de tes réponses est un peu trop longue ou incomplète. Raccourcis-la un peu et réessaie.";
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

// ─────────────────────────────────────────────────────────────────────────────
// BriefForm — Tunnel de création adaptatif
//
// Flux dynamique selon `brief.campaignType` :
//   social : type → product → audience → networks+subject → objective (5 étapes)
//   ads    : type → product → audience → ads-details        → objective (5 étapes)
//   email  : type → product → audience → objective                       (4 étapes)
//
// Le compteur "Étape X sur N" et la barre de progression s'adaptent.
// ─────────────────────────────────────────────────────────────────────────────

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
  const t = useT();
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [showEncouragement, setShowEncouragement] = useState<string | null>(null);

  // Nombre d'étapes : email passe directement à l'objectif (pas de "networks").
  const totalSteps = brief.campaignType === "email" ? 4 : 5;

  function nextStep(encouragement?: string | null) {
    if (encouragement) {
      setShowEncouragement(encouragement);
      setTimeout(() => {
        setShowEncouragement(null);
        setStep((s) => Math.min(s + 1, totalSteps - 1));
        setAnimKey((k) => k + 1);
      }, 900);
    } else {
      setStep((s) => Math.min(s + 1, totalSteps - 1));
      setAnimKey((k) => k + 1);
    }
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
    setAnimKey((k) => k + 1);
  }

  const canProductNext = brief.product.trim().length >= 8;
  const canAudienceNext = brief.audience.trim().length >= 8;

  const progressPercent = ((step + 1) / totalSteps) * 100;

  // Récap dynamique du bandeau du bas selon le type choisi.
  const footerByType: Record<CampaignType, string> = {
    social: t("🎁 Posts gratuits. On publie sur tes réseaux après ta validation, pas de carte bancaire demandée."),
    ads: t("💳 La publicité payante demande un budget. Tu valides chaque dépense avant qu'on lance."),
    email: t("📩 Envoi à ta base de contacts. Tu valides le contenu avant le départ."),
  };
  const footerText = brief.campaignType
    ? footerByType[brief.campaignType]
    : t("🎁 C'est gratuit pour commencer. Choisis ton type de campagne pour voir ce que je peux faire pour toi.");

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-500/40 animate-pop-in">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">{t("On fait connaissance ? ✨")}</h1>
        <p className="text-muted-foreground text-lg">{t("Une petite question à la fois, c'est promis 🙂")}</p>
      </div>

      <div className="max-w-md mx-auto space-y-2" aria-label={t("progression")}>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-violet-700">{t("Étape {step} sur {total}", { step: step + 1, total: totalSteps })}</span>
          <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-blue-600 rounded-full transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {showEncouragement ? (
        <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-300" data-testid="encouragement">
          <div className="text-6xl mb-3 animate-bounce">🎉</div>
          <p className="text-2xl font-bold bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">{t(showEncouragement)}</p>
        </div>
      ) : (
        <div
          key={animKey}
          className={`bg-card rounded-2xl border shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 ${
            step === 0 ? "max-w-5xl mx-auto" : ""
          }`}
        >
          {step === 0 && (
            <StepCampaignType
              value={brief.campaignType}
              setValue={(v) => {
                // Reset des champs spécifiques au path quand on change de type.
                setBrief({
                  ...brief,
                  campaignType: v,
                  channels: [],
                  objective: "",
                  subject: "",
                  siteUrl: "",
                  budget: "",
                });
              }}
              onNext={() => nextStep(null)}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
          {step === 1 && (
            <StepProduct
              value={brief.product}
              setValue={(v) => setBrief({ ...brief, product: v })}
              canNext={canProductNext}
              onNext={() => nextStep(ENCOURAGEMENTS[0])}
              onBack={prevStep}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
          {step === 2 && (
            <StepAudience
              value={brief.audience}
              setValue={(v) => setBrief({ ...brief, audience: v })}
              canNext={canAudienceNext}
              onNext={() => nextStep(ENCOURAGEMENTS[1])}
              onBack={prevStep}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
          {step === 3 && brief.campaignType === "social" && (
            <StepSocialNetworks
              channels={brief.channels}
              setChannels={(c) => setBrief({ ...brief, channels: c })}
              subject={brief.subject ?? ""}
              setSubject={(v) => setBrief({ ...brief, subject: v })}
              onNext={() => nextStep(ENCOURAGEMENTS[2])}
              onBack={prevStep}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
          {step === 3 && brief.campaignType === "ads" && (
            <StepAdsDetails
              channels={brief.channels}
              setChannels={(c) => setBrief({ ...brief, channels: c })}
              siteUrl={brief.siteUrl ?? ""}
              setSiteUrl={(v) => setBrief({ ...brief, siteUrl: v })}
              budget={brief.budget}
              setBudget={(v) => setBrief({ ...brief, budget: v })}
              onNext={() => nextStep(ENCOURAGEMENTS[2])}
              onBack={prevStep}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
          {step === 3 && brief.campaignType === "email" && (
            <StepObjective
              objectives={OBJECTIVES_EMAIL}
              value={brief.objective}
              setValue={(v) => setBrief({ ...brief, objective: v })}
              onSubmit={onSubmit}
              onBack={prevStep}
              loading={loading}
              currentStep={step + 1}
              totalSteps={totalSteps}
              emailStyle={brief.emailStyle}
              setEmailStyle={(s) => setBrief({ ...brief, emailStyle: s })}
            />
          )}
          {step === 4 && brief.campaignType === "social" && (
            <StepObjective
              objectives={OBJECTIVES_SOCIAL}
              value={brief.objective}
              setValue={(v) => setBrief({ ...brief, objective: v })}
              onSubmit={onSubmit}
              onBack={prevStep}
              loading={loading}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
          {step === 4 && brief.campaignType === "ads" && (
            <StepObjective
              objectives={OBJECTIVES_ADS}
              value={brief.objective}
              setValue={(v) => setBrief({ ...brief, objective: v })}
              onSubmit={onSubmit}
              onBack={prevStep}
              loading={loading}
              currentStep={step + 1}
              totalSteps={totalSteps}
            />
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground max-w-2xl mx-auto">
        {footerText}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 — Choix du type de campagne (3 cartes)
// ─────────────────────────────────────────────────────────────────────────────

function StepCampaignType({
  value,
  setValue,
  onNext,
  currentStep,
  totalSteps,
}: {
  value: CampaignType | undefined;
  setValue: (v: CampaignType) => void;
  onNext: () => void;
  currentStep: number;
  totalSteps: number;
}) {
  const t = useT();
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          {t("Question {currentStep} sur {totalSteps}", { currentStep, totalSteps })}
        </div>
        <h2 className="text-2xl font-bold">{t("Quel type de campagne tu veux lancer ? 🚀")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("Choisis le canal qui te ressemble. Chaque type est conçu pour un objectif différent.")}
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {CAMPAIGN_TYPES.map((ct) => {
          const Icon = ct.icon;
          const active = value === ct.value;
          return (
            <button
              key={ct.value}
              type="button"
              data-testid={`campaign-type-${ct.value}`}
              onClick={() => setValue(ct.value)}
              aria-pressed={active}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] flex flex-col ${
                active
                  ? "border-primary bg-primary/15 shadow-lg scale-[1.02] ring-2 ring-primary/40"
                  : "border-border hover:border-violet-300 bg-card"
              }`}
            >
              {!ct.available && (
                <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/100/15 text-amber-300 uppercase tracking-wider">
                  {t("Bientôt")}
                </span>
              )}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ct.color} flex items-center justify-center mb-3 shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-base">{t(ct.label)}</span>
                <span className="text-xs font-semibold text-violet-600 uppercase">{t(ct.sub)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t(ct.description)}</p>
              <div className="mt-4 pt-3 border-t border-border/70 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Ce que je vais faire pour toi :")}
                </div>
                <ul className="space-y-1">
                  {ct.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                      <CheckIcon className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{t(d)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
      <Button
        onClick={onNext}
        disabled={!value}
        data-testid="button-next-type"
        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
      >
        {t("Continuer →")}
      </Button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 2 — Produit / service
// ─────────────────────────────────────────────────────────────────────────────

function StepProduct({
  value,
  setValue,
  canNext,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: {
  value: string;
  setValue: (v: string) => void;
  canNext: boolean;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}) {
  const t = useT();
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          {t("Question {currentStep} sur {totalSteps}", { currentStep, totalSteps })}
        </div>
        <h2 className="text-2xl font-bold">{t("Tu proposes quoi ? 🤔")}</h2>
        <p className="text-muted-foreground text-sm">{t("Dis-le avec tes mots, comme si tu en parlais à un ami.")}</p>
      </div>
      <Textarea
        data-testid="input-product"
        placeholder={t("Ex : Je vends des bougies parfumées faites à la main, dans ma boutique à Lyon et en ligne.")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={3}
        className="text-base"
        autoFocus
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("💡 Pas d'idée ? Clique sur un exemple :")}</p>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setValue(t(ex.text))}
              className="px-3 py-2 rounded-full border bg-card hover:bg-primary/10 hover:border-violet-300 text-sm transition-all hover:scale-105"
              data-testid={`example-product-${ex.label}`}
            >
              {ex.emoji} {t(ex.label)}
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
          data-testid="button-next-1"
          className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
        >
          {t("Continuer →")}
        </Button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 3 — Audience cible
// ─────────────────────────────────────────────────────────────────────────────

function StepAudience({
  value,
  setValue,
  canNext,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: {
  value: string;
  setValue: (v: string) => void;
  canNext: boolean;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}) {
  const t = useT();
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          {t("Question {currentStep} sur {totalSteps}", { currentStep, totalSteps })}
        </div>
        <h2 className="text-2xl font-bold">{t("À qui tu veux parler ? 👥")}</h2>
        <p className="text-muted-foreground text-sm">{t("Décris les gens que tu aimerais avoir comme clients : âge, ce qu'ils aiment, où ils habitent.")}</p>
      </div>
      <Textarea
        data-testid="input-audience"
        placeholder={t("Ex : Des femmes entre 30 et 50 ans qui aiment leur intérieur et les choses bien faites.")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={3}
        className="text-base"
        autoFocus
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("💡 Pas d'idée ? Clique sur un exemple :")}</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setValue(t(ex.text))}
              className="px-3 py-2 rounded-full border bg-card hover:bg-primary/10 hover:border-violet-300 text-sm transition-all hover:scale-105"
              data-testid={`example-audience-${ex.label}`}
            >
              {ex.emoji} {t(ex.label)}
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
          {t("Continuer →")}
        </Button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 4 (social) — Choix des réseaux + sujet du post
// ─────────────────────────────────────────────────────────────────────────────

function StepSocialNetworks({
  channels,
  setChannels,
  subject,
  setSubject,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: {
  channels: Channel[];
  setChannels: (c: Channel[]) => void;
  subject: string;
  setSubject: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}) {
  function toggle(c: Channel) {
    setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c]);
  }
  const hasAtLeastOne = channels.some((c) =>
    SOCIAL_NETWORKS.some((n) => n.value === c && n.available),
  );
  const canNext = hasAtLeastOne; // sujet est optionnel
  const t = useT();
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          {t("Question {currentStep} sur {totalSteps}", { currentStep, totalSteps })}
        </div>
        <h2 className="text-2xl font-bold">{t("Sur quels réseaux on publie ? 📱")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("Choisis un ou plusieurs réseaux. Je m'occupe du reste.")}
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {SOCIAL_NETWORKS.map((n) => {
          const Icon = n.icon;
          const checked = channels.includes(n.value);
          const disabled = !n.available;
          return (
            <button
              key={n.value}
              type="button"
              data-testid={`network-${n.value}`}
              onClick={() => !disabled && toggle(n.value)}
              disabled={disabled}
              aria-pressed={checked}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                disabled
                  ? "opacity-50 cursor-not-allowed border-border bg-muted"
                  : checked
                    ? "border-primary bg-primary/15 shadow-md scale-[1.02]"
                    : "border-border hover:border-violet-300 hover:scale-[1.02] bg-card"
              }`}
            >
              {disabled && (
                <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/100/15 text-amber-300 uppercase">
                  {t("Bientôt")}
                </span>
              )}
              <div className={`w-10 h-10 rounded-lg ${n.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${n.color}`} />
              </div>
              <div className="font-semibold text-sm">{n.label}</div>
              {checked && (
                <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                  <CheckIcon className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 pt-2">
        <Label htmlFor="subject" className="text-sm font-semibold">
          {t("Quel est le sujet de ton post ?")} <span className="text-muted-foreground font-normal">{t("(optionnel)")}</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("Par exemple : « Promo de Noël », « Ouverture du nouveau salon », « Témoignage cliente ». Si tu laisses vide, je trouve les sujets pour toi.")}
        </p>
        <Textarea
          id="subject"
          data-testid="input-subject"
          placeholder={t("Ex : Annonce de ma nouvelle collection de bougies de Noël.")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-14 px-6">
          ←
        </Button>
        <Button
          onClick={onNext}
          disabled={!canNext}
          data-testid="button-next-networks"
          className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
        >
          {t("Continuer →")}
        </Button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 4 (ads) — Réseaux pub + URL du site + budget
// ─────────────────────────────────────────────────────────────────────────────

function StepAdsDetails({
  channels,
  setChannels,
  siteUrl,
  setSiteUrl,
  budget,
  setBudget,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: {
  channels: Channel[];
  setChannels: (c: Channel[]) => void;
  siteUrl: string;
  setSiteUrl: (v: string) => void;
  budget: string;
  setBudget: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}) {
  function toggle(c: Channel) {
    setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c]);
  }
  const urlValid = /^https?:\/\/.+\..+/i.test(siteUrl.trim());
  const budgetValid = budget.trim().length > 0;
  const hasAtLeastOne = channels.some((c) => ADS_NETWORKS.some((n) => n.value === c));
  const canNext = urlValid && budgetValid && hasAtLeastOne;
  const t = useT();

  const BUDGET_PRESETS = ["50 € / mois", "150 € / mois", "300 € / mois", "500 € / mois"];

  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          {t("Question {currentStep} sur {totalSteps}", { currentStep, totalSteps })}
        </div>
        <h2 className="text-2xl font-bold">{t("Détails de ta publicité 🎯")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("Quelques infos précises pour que je puisse cibler les bonnes personnes.")}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t("Quels réseaux publicitaires ?")}</Label>
        <div className="grid sm:grid-cols-2 gap-3">
          {ADS_NETWORKS.map((n) => {
            const Icon = n.icon;
            const checked = channels.includes(n.value);
            return (
              <button
                key={n.value}
                type="button"
                data-testid={`ad-network-${n.value}`}
                onClick={() => toggle(n.value)}
                aria-pressed={checked}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  checked
                    ? "border-primary bg-primary/15 shadow-md scale-[1.02]"
                    : "border-border hover:border-violet-300 hover:scale-[1.02] bg-card"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${n.bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-5 h-5 ${n.color}`} />
                </div>
                <div className="font-semibold text-sm">{n.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t(n.desc)}</div>
                {checked && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="siteUrl" className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-violet-600" /> {t("Le lien de ton site (URL)")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("C'est la page où on enverra les gens qui cliquent sur ta pub.")}
        </p>
        <input
          id="siteUrl"
          type="url"
          data-testid="input-site-url"
          placeholder="https://monsite.fr"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          className="w-full h-11 px-3 rounded-md border border-input bg-background text-base"
        />
        {siteUrl.trim() && !urlValid && (
          <p className="text-xs text-amber-600">{t("⚠️ L'adresse doit commencer par http:// ou https://")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget" className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-violet-600" /> {t("Ton budget estimé")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("Combien tu es prêt à dépenser. On commence petit, on ajuste après.")}
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {BUDGET_PRESETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(b)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                budget === b
                  ? "border-primary bg-primary/15 text-foreground font-semibold"
                  : "border-border bg-card hover:border-violet-300"
              }`}
              data-testid={`budget-preset-${b.replace(/\s/g, "-")}`}
            >
              {t(b)}
            </button>
          ))}
        </div>
        <input
          id="budget"
          type="text"
          data-testid="input-budget"
          placeholder={t("Ou écris ton montant : ex. 250 € pour 2 semaines")}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full h-11 px-3 rounded-md border border-input bg-background text-base"
        />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-14 px-6">
          ←
        </Button>
        <Button
          onClick={onNext}
          disabled={!canNext}
          data-testid="button-next-ads"
          className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
        >
          {t("Continuer →")}
        </Button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape finale — Objectif (la liste change selon le type de campagne)
// ─────────────────────────────────────────────────────────────────────────────

function StepObjective({
  objectives,
  value,
  setValue,
  onSubmit,
  onBack,
  loading,
  currentStep,
  totalSteps,
  emailStyle,
  setEmailStyle,
}: {
  objectives: ObjectiveOption[];
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  currentStep: number;
  totalSteps: number;
  // Présents uniquement pour le flux email : affichent le choix vouvoiement/tutoiement.
  emailStyle?: EmailStyle;
  setEmailStyle?: (s: EmailStyle) => void;
}) {
  const t = useT();
  const isLast = currentStep === totalSteps;
  return (
    <>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          {t("Question {currentStep} sur {totalSteps}", { currentStep, totalSteps })}{isLast ? t(" — la dernière !") : ""}
        </div>
        <h2 className="text-2xl font-bold">{t("Qu'est-ce que tu veux obtenir ? 🎯")}</h2>
        <p className="text-muted-foreground text-sm">{t("Choisis ce qui compte le plus pour toi en ce moment.")}</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {objectives.map((o) => {
          const Icon = o.icon;
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              data-testid={`objective-${o.value.replace(/[\s/]/g, "-")}`}
              onClick={() => setValue(o.value)}
              aria-pressed={active}
              className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] flex flex-col ${
                active ? "border-primary bg-primary/15 shadow-md scale-[1.02]" : "border-border hover:border-violet-300 bg-card"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${o.color} flex items-center justify-center mb-2 shadow-sm`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="font-semibold text-sm">{t(o.label)}</div>
              <div className="text-xs text-muted-foreground mt-1">{t(o.description)}</div>
              <div className="mt-3 pt-3 border-t border-border/70 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Ce que je vais faire pour toi :")}
                </div>
                <ul className="space-y-1">
                  {o.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                      <CheckIcon className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{t(d)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
      {emailStyle && setEmailStyle && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">
            {t("Comment je m'adresse à tes contacts ?")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="email-style-vouvoiement"
              onClick={() => setEmailStyle("vouvoiement")}
              aria-pressed={emailStyle === "vouvoiement"}
              className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                emailStyle === "vouvoiement"
                  ? "border-primary bg-primary/15 shadow-md"
                  : "border-border hover:border-violet-300 bg-card"
              }`}
            >
              <div className="font-semibold text-sm">{t("Vouvoiement")}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("Plus poli et professionnel (« vous »). Recommandé.")}
              </div>
            </button>
            <button
              type="button"
              data-testid="email-style-tutoiement"
              onClick={() => setEmailStyle("tutoiement")}
              aria-pressed={emailStyle === "tutoiement"}
              className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                emailStyle === "tutoiement"
                  ? "border-primary bg-primary/15 shadow-md"
                  : "border-border hover:border-violet-300 bg-card"
              }`}
            >
              <div className="font-semibold text-sm">{t("Tutoiement")}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("Plus proche et chaleureux (« tu »).")}
              </div>
            </button>
          </div>
        </div>
      )}
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
              <Wand2 className="w-6 h-6 mr-2" /> {t("Créer ma campagne 🚀")}
            </>
          )}
        </Button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran "Bientôt disponible" pour les paths Ads & Email
// (le brief reste en mémoire frontend, rien n'est appelé côté backend)
// ─────────────────────────────────────────────────────────────────────────────

function ComingSoonScreen({
  brief,
  notificationEmail,
  setNotificationEmail,
  onBack,
  onNew,
}: {
  brief: AgencyBrief;
  notificationEmail: string;
  setNotificationEmail: (v: string) => void;
  onBack: () => void;
  onNew: () => void;
}) {
  const t = useT();
  const typeMeta = CAMPAIGN_TYPES.find((ct) => ct.value === brief.campaignType);
  const Icon = typeMeta?.icon ?? Sparkles;
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${typeMeta?.color ?? "from-violet-500 to-purple-600"} shadow-lg`}>
          <Icon className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("Bientôt disponible 🚧")}</h1>
          <p className="text-muted-foreground text-lg">
            {t("On travaille dur sur les campagnes")} <strong>{typeMeta ? t(typeMeta.label) : ""}</strong>{t(". C'est en bonne voie !")}
          </p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-200">
              {t("Pourquoi ce n'est pas encore prêt ?")}
            </p>
            <p className="text-xs text-amber-200 leading-relaxed">
              {brief.campaignType === "ads"
                ? t("On attend les validations finales de Meta (Business Manager) et de Google (developer token). Délai estimé : quelques semaines. En attendant, tu peux lancer une campagne Réseaux Sociaux gratuite — c'est déjà très efficace !")
                : t("On finalise le système de gestion de tes contacts et de programmation des envois. En attendant, tu peux lancer une campagne Réseaux Sociaux gratuite pour préparer le terrain.")}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-sm">{t("Ton brief (gardé pour cette session) 📝")}</h3>
        <p className="text-xs text-muted-foreground -mt-2">
          {t("Pour l'instant on ne le sauvegarde pas côté serveur — tu pourras le ressaisir quand la fonctionnalité sera prête.")}
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-24">{t("Ce que tu proposes :")}</span>
            <span className="font-medium flex-1">{brief.product}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-24">{t("Ta cible :")}</span>
            <span className="font-medium flex-1">{brief.audience}</span>
          </div>
          {brief.siteUrl && (
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-24">{t("Ton site :")}</span>
              <a href={brief.siteUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline flex-1 break-all">
                {brief.siteUrl}
              </a>
            </div>
          )}
          {brief.budget && (
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-24">{t("Ton budget :")}</span>
              <span className="font-medium flex-1">{brief.budget}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-24">{t("Ton objectif :")}</span>
            <span className="font-medium flex-1">{brief.objective}</span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
        <Label htmlFor="notif-email" className="text-sm font-semibold">
          {t("📬 Préviens-moi quand c'est disponible")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("Laisse ton email, on te recontacte dès que la fonctionnalité est prête.")}
        </p>
        <input
          id="notif-email"
          type="email"
          data-testid="input-notif-email"
          placeholder="ton@email.fr"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          className="w-full h-11 px-3 rounded-md border border-input bg-background text-base"
        />
        <p className="text-[11px] text-muted-foreground italic">
          {t("Pour l'instant on ne stocke pas ton email automatiquement — note-le, on l'ajoutera à la liste d'attente bientôt.")}
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 flex-1">
          {t("← Modifier mon brief")}
        </Button>
        <Button
          onClick={onNew}
          data-testid="button-new-social"
          className="h-12 flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
        >
          <MessageCircle className="w-4 h-4 mr-2" /> {t("Essayer Réseaux Sociaux")}
        </Button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  const t = useT();
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
    const timer = setInterval(() => setIdx((i) => Math.min(i + 1, messages.length - 1)), 8000);
    return () => clearInterval(timer);
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
        <h2 className="text-2xl font-bold">{t("Je travaille pour toi…")}</h2>
        <p className="text-muted-foreground text-lg transition-all min-h-[28px]">{t(messages[idx])}</p>
        <p className="text-sm text-muted-foreground pt-6 max-w-md mx-auto">
          {t("☕ C'est le bon moment pour aller te chercher un café. Ça prend environ une minute.")}
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
  const t = useT();
  const launched = campaign.status === "launched";
  const { plan } = campaign;
  const channelsUsed = Array.from(new Set(plan.posts.map((p) => p.channel)));
  const channels = useConnectedChannels(!launched);
  // Verify the user has at least one channel connected that matches what the
  // plan will publish on. Without this, "Lancer" would queue posts that the
  // worker would silently reject (or — before the multi-tenant fix — publish
  // on the admin's pages).
  const planNeedsFacebook = channelsUsed.includes("facebook");
  const planNeedsInstagram = channelsUsed.includes("instagram");
  const planNeedsLinkedin = channelsUsed.includes("linkedin");
  const missingChannels: string[] = [];
  if (planNeedsFacebook && !channels.facebook) missingChannels.push("Facebook");
  if (planNeedsInstagram && !channels.instagram) missingChannels.push("Instagram");
  if (planNeedsLinkedin && !channels.linkedin) missingChannels.push("LinkedIn");
  const canLaunch = !channels.loading && missingChannels.length === 0;
  // Confirmation explicite obligatoire avant le lancement (anti-lancement accidentel).
  const [todoChecked, setTodoChecked] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">{t("Voilà ce que j'ai préparé 🎉")}</h1>
          <p className="text-muted-foreground">{t("Regarde, modifie si tu veux, puis appuie sur le gros bouton vert.")}</p>
        </div>
        <div className="flex items-center gap-2 bg-card border rounded-full px-4 py-2 shadow-sm">
          <HelpCircle className="w-4 h-4 text-violet-600" />
          <Label htmlFor="explain" className="text-sm cursor-pointer">{t("Explique-moi tout")}</Label>
          <Switch id="explain" checked={explainMode} onCheckedChange={setExplainMode} data-testid="switch-explain" />
        </div>
      </div>

      {explainMode && (
        <div className="bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 border-2 border-purple-500/30 rounded-2xl p-6 space-y-3" data-testid="explain-box">
          <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
            <Lightbulb className="w-5 h-5" /> {t("Mes choix, expliqués comme à un enfant")}
          </h3>
          {plan.decisions && plan.decisions.length > 0 ? (
            <ul className="space-y-3">
              {plan.decisions.map((d, i) => (
                <li key={i} className="bg-white/10 rounded-lg p-3">
                  <div className="font-semibold text-foreground text-sm">✓ {d.what}</div>
                  <div className="text-sm text-foreground mt-1">→ {d.why}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground bg-white/10 rounded-lg p-3">
              {t("😊 Cette campagne a été créée avant cette nouveauté, donc je n'ai pas gardé le détail de mes choix. Pour les prochaines, tu verras ici tout ce que j'ai décidé et pourquoi.")}
            </p>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <FriendlyCard emoji="👥" title={t("Pour qui je travaille")} body={plan.audienceSummary} />
        <FriendlyCard
          emoji="📊"
          title={t("Ce que ça pourrait donner")}
          body={`${plan.estimatedResults.impressions}\n${plan.estimatedResults.clicks}\n${plan.estimatedResults.conversions}`}
        />
        <FriendlyCard
          emoji="📅"
          title={t("Quand on publie")}
          body={t("{count} messages sur 7 jours\nsur {channels}", {
            count: plan.posts.length,
            channels: channelsUsed.map((c) => c === "facebook" ? "Facebook" : c === "linkedin" ? "LinkedIn" : "Instagram").join(t(" et ")),
          })}
        />
      </div>

      <div className="bg-card rounded-2xl border p-5 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">{t("🎯 Comment je vais les trouver")}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{plan.targetingNarrative}</p>
      </div>

      <div className="bg-card rounded-2xl border p-5 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">{t("💰 Côté argent")}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{plan.budgetNarrative}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">{t("📬 Tes messages prêts à partir ({count})", { count: plan.posts.length })}</h2>
        <p className="text-sm text-muted-foreground">{t("Tu peux modifier le texte ou la date en cliquant dessus.")}</p>
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
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-5 space-y-2">
          <h3 className="font-bold flex items-center gap-2 text-amber-200">
            <Lightbulb className="w-5 h-5" /> {t("Mes petits conseils en plus")}
          </h3>
          <ul className="text-sm text-amber-200 space-y-2">
            {plan.recommendations.map((r, i) => <li key={i}>✨ {r}</li>)}
          </ul>
        </div>
      )}

      {!launched && (
        <div className="bg-card rounded-2xl border-2 border-purple-100 p-5 space-y-4 sticky bottom-4 shadow-xl">
          {!canLaunch && !channels.loading && (
            <div
              className="flex items-start gap-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4"
              data-testid="launch-blocked-warning"
            >
              <Lightbulb className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-200 space-y-1">
                <p className="font-semibold">
                  {t("Tu dois connecter {channels} pour pouvoir lancer cette campagne.", { channels: missingChannels.join(t(" et ")) })}
                </p>
                <p>
                  {t("Va dans ton profil et connecte le ou les comptes manquants. Sans ça, tes messages ne pourront pas partir.")}{" "}
                  <Link href="/app/account" className="underline font-medium">
                    {t("Ouvrir mon profil →")}
                  </Link>
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="font-semibold">{t("📧 Ton email (facultatif)")}</Label>
            <input
              id="email"
              type="email"
              placeholder={t("pour qu'on te confirme par email")}
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              data-testid="input-email"
              className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted p-3">
            <Checkbox
              id="todo-checkbox"
              checked={todoChecked}
              onCheckedChange={(v) => setTodoChecked(v === true)}
              data-testid="checkbox-todo"
            />
            <Label htmlFor="todo-checkbox" className="text-sm text-muted-foreground cursor-pointer">
              {t("J'ai vérifié les textes et les dates — je confirme le lancement")}
            </Label>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} disabled={loading} className="flex-1 h-12">
              {t("← Refaire les réponses")}
            </Button>
            <Button
              onClick={onLaunch}
              disabled={loading || !canLaunch || !todoChecked}
              data-testid="button-launch"
              className="flex-[2] h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30 disabled:from-slate-400 disabled:to-slate-500 disabled:shadow-none"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{t("🚀 Lancer")}</>}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t("✅ Une fois lancé, je publie tout seul aux horaires prévus. Tu n'as plus rien à faire.")}
          </p>
        </div>
      )}

      {launched && (
        <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
          <div>
            <p className="font-bold text-green-200">{t("Campagne lancée le {date} ✨", { date: new Date(campaign.launchedAt!).toLocaleString("fr-FR") })}</p>
            <p className="text-sm text-green-200">{t("Les messages partiront tout seuls aux dates prévues. Profite de ta journée !")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FriendlyCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="bg-card rounded-2xl border p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-2xl">{emoji}</span> {title}
      </div>
      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{body}</p>
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
  const t = useT();
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
    <div className="bg-muted rounded-2xl border overflow-hidden flex flex-col shadow-sm hover:shadow-md transition">
      {post.channel === "instagram" ? (
        <InstagramMockup post={post} index={index} />
      ) : post.channel === "linkedin" ? (
        <LinkedinMockup post={post} index={index} />
      ) : (
        <FacebookMockup post={post} index={index} />
      )}

      <div className="p-4 space-y-3 bg-card border-t">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
          {t("✏️ Modifie si tu veux")}
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
  const t = useT();
  return (
    <div className="bg-card">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-xs font-bold">
              T
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold">ta_marque</div>
            <div className="text-[10px] text-muted-foreground">{t("Sponsorisé")}</div>
          </div>
        </div>
        <MoreHorizontal className="w-4 h-4 text-foreground" />
      </div>
      <div className="aspect-square bg-muted relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Post ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
            <Instagram className="w-8 h-8" />
            {t("Image en cours…")}
          </div>
        )}
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-foreground" />
            <MessageCircle className="w-5 h-5 text-foreground" />
            <Send className="w-5 h-5 text-foreground" />
          </div>
          <Bookmark className="w-5 h-5 text-foreground" />
        </div>
        <div className="text-xs font-semibold">{t("{count} mentions J'aime", { count: 124 + index * 17 })}</div>
        <div className="text-xs text-foreground whitespace-pre-wrap break-words">
          <span className="font-semibold">ta_marque</span>{" "}
          <span>{post.copy}</span>
        </div>
        <div className="text-[10px] text-muted-foreground uppercase">{t("Il y a quelques instants")}</div>
      </div>
    </div>
  );
}

function FacebookMockup({ post, index }: { post: PlannedPost; index: number }) {
  const t = useT();
  return (
    <div className="bg-card">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
            T
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">{t("Ta marque")}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              {t("Sponsorisé · ")}<span className="text-blue-600">🌐</span>
            </div>
          </div>
        </div>
        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="px-3 pb-2.5 text-sm text-foreground whitespace-pre-wrap break-words">
        {post.copy}
      </div>
      <div className="aspect-[4/3] bg-muted relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Pub ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
            <Facebook className="w-8 h-8" />
            {t("Image en cours…")}
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-muted flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
          {t("En savoir plus")}
        </div>
        <div className="text-[10px] text-muted-foreground">tamarque.fr</div>
      </div>
      <div className="px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground border-t">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-blue-600 inline-flex items-center justify-center">
            <ThumbsUp className="w-2.5 h-2.5 text-white" />
          </span>
          <span>{286 + index * 23}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">{t("{comments} commentaires · {shares} partages", { comments: 34 + index * 3, shares: 12 + index })}</div>
      </div>
      <div className="grid grid-cols-3 border-t text-xs text-muted-foreground font-medium">
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-muted"><ThumbsUp className="w-3.5 h-3.5" /> {t("J'aime")}</button>
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-muted"><MessageCircle className="w-3.5 h-3.5" /> {t("Commenter")}</button>
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-muted"><Share2 className="w-3.5 h-3.5" /> {t("Partager")}</button>
      </div>
    </div>
  );
}

function LinkedinMockup({ post, index }: { post: PlannedPost; index: number }) {
  const t = useT();
  return (
    <div className="bg-card">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] flex items-center justify-center text-white text-sm font-bold">
            T
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">{t("Ta marque")}</div>
            <div className="text-[11px] text-muted-foreground">{t("Entreprise · Sponsorisé")}</div>
          </div>
        </div>
        <Linkedin className="w-5 h-5 text-[#0a66c2]" />
      </div>
      <div className="px-3 pb-2.5 text-sm text-foreground whitespace-pre-wrap break-words">
        {post.copy}
      </div>
      <div className="aspect-[4/3] bg-muted relative">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={`Post ${index}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
            <Linkedin className="w-8 h-8" />
            {t("Image en cours…")}
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground border-t">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-[#0a66c2] inline-flex items-center justify-center">
            <ThumbsUp className="w-2.5 h-2.5 text-white" />
          </span>
          <span>{142 + index * 19}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">{t("{comments} commentaires · {shares} republications", { comments: 18 + index * 2, shares: 7 + index })}</div>
      </div>
      <div className="grid grid-cols-3 border-t text-xs text-muted-foreground font-medium">
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-muted"><ThumbsUp className="w-3.5 h-3.5" /> {t("J'aime")}</button>
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-muted"><MessageCircle className="w-3.5 h-3.5" /> {t("Commenter")}</button>
        <button className="py-1.5 flex items-center justify-center gap-1.5 hover:bg-muted"><Share2 className="w-3.5 h-3.5" /> {t("Republier")}</button>
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
  const t = useT();
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">{t("C'est parti !")}</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          {t("J'ai programmé {count} messages. Ils partiront tout seuls aux dates prévues. Tu n'as plus rien à faire 😊", { count: campaign.plan.posts.length })}
        </p>
        {campaign.notificationEmail && emailStatus?.sent && (
          <p className="text-sm text-green-300">{t("📧 Récap envoyé à {email} (pense à vérifier tes spams).", { email: campaign.notificationEmail })}</p>
        )}
        {campaign.notificationEmail && emailStatus && !emailStatus.sent && (
          <div className="max-w-md mx-auto bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-left text-sm text-amber-200">
            <p className="font-semibold">{t("📧 L'email récap n'est pas parti.")}</p>
            <p className="text-xs mt-1">
              {t("Ta campagne, elle, est bien lancée ! Côté email, ça vient probablement de l'adresse expéditeur configurée. Détail technique : {detail}.", { detail: emailStatus.error?.slice(0, 200) || t("raison inconnue") })}
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-3 pt-2 flex-wrap">
        <Button variant="outline" onClick={onDashboard} className="h-11">{t("Voir mes campagnes")}</Button>
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
          <Wand2 className="w-4 h-4 mr-2" /> {t("En lancer une autre")}
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
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("Mes campagnes 📋")}</h1>
          <p className="text-muted-foreground">{campaigns.length === 0 ? t("Pas encore de campagne") : t("{count} campagne(s) en tout", { count: campaigns.length })}</p>
        </div>
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
          <Wand2 className="w-4 h-4 mr-2" /> {t("En lancer une nouvelle")}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border">
          <div className="text-5xl mb-3">🌱</div>
          <p className="text-muted-foreground mb-4">{t("Aucune campagne pour l'instant. On commence ?")}</p>
          <Button onClick={onNew}>{t("Créer ma première campagne")}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border p-5 flex items-center justify-between gap-4 hover:shadow-md transition" data-testid={`campaign-${c.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <Badge variant={c.status === "launched" ? "default" : "secondary"} className={c.status === "launched" ? "bg-green-600" : ""}>
                    {c.status === "launched" ? t("✅ Lancée") : c.status === "launching" ? t("⏳ En cours") : t("📝 Brouillon")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{t("{count} messages · créée le {date}", { count: c.plan.posts.length, date: new Date(c.createdAt).toLocaleDateString("fr-FR") })}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => onView(c)}>
                  <Eye className="w-4 h-4 mr-1" /> {t("Voir")}
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

// ─────────────────────────────────────────────────────────────────────────────
// Écran preview email + sélection destinataires + envoi
// ─────────────────────────────────────────────────────────────────────────────

// Convertit le texte saisi par l'utilisateur en HTML simple, pour que le mail
// envoyé corresponde exactement à ce qu'il a écrit (paragraphes + retours ligne).
function textToSimpleHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

type SenderInfo = { usingOwnKey: boolean; fromEmail: string | null; fromName: string | null };

function EmailPreviewScreen({
  campaign,
  setCampaign,
  onSent,
  onBack,
}: {
  campaign: EmailCampaignRow;
  setCampaign: (c: EmailCampaignRow) => void;
  onSent: (result: { sent: number; failed: number; total: number }) => void;
  onBack: () => void;
}) {
  const t = useT();
  const [contacts, setContacts] = useState<EmailContactRow[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allSubscribed, setAllSubscribed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(campaign.subject);
  const [bodyText, setBodyText] = useState(campaign.bodyText);
  const [sending, setSending] = useState(false);
  const [sender, setSender] = useState<SenderInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = campaign.attachments ?? [];

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(API("/email/contacts"));
        if (r.ok) {
          const rows: EmailContactRow[] = await r.json();
          setContacts(rows);
        }
      } catch { /* silent */ }
      finally { setLoadingContacts(false); }
    })();
    void (async () => {
      try {
        const r = await fetch(API("/email/sender"));
        if (r.ok) setSender(await r.json());
      } catch { /* silent */ }
    })();
  }, []);

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("Fichier trop lourd (10 Mo maximum)."));
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result);
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const r = await fetch(API(`/email/campaigns/${campaign.id}/attachments`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          dataBase64,
        }),
      });
      if (r.ok) {
        setCampaign(await r.json());
        toast.success(t("Pièce jointe ajoutée"));
      } else {
        const err = await r.json().catch(() => ({ error: "Oups" }));
        toast.error(t(err.error || "Impossible d'ajouter la pièce jointe"));
      }
    } catch {
      toast.error(t("La connexion a coupé"));
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(index: number) {
    try {
      const r = await fetch(API(`/email/campaigns/${campaign.id}/attachments/${index}`), {
        method: "DELETE",
      });
      if (r.ok) {
        setCampaign(await r.json());
      } else {
        toast.error(t("Impossible de retirer la pièce jointe"));
      }
    } catch {
      toast.error(t("La connexion a coupé"));
    }
  }

  function toggle(id: number) {
    setAllSubscribed(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveEdits() {
    try {
      // On régénère le HTML à partir du texte saisi pour que le mail envoyé
      // corresponde exactement à ce que l'utilisateur a écrit.
      const bodyHtml = textToSimpleHtml(bodyText);
      const r = await fetch(API(`/email/campaigns/${campaign.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, bodyHtml }),
      });
      if (r.ok) {
        const updated: EmailCampaignRow = await r.json();
        setCampaign(updated);
        setEditing(false);
        toast.success(t("Modifications enregistrées"));
      } else {
        toast.error(t("Impossible d'enregistrer"));
      }
    } catch {
      toast.error(t("La connexion a coupé"));
    }
  }

  async function send() {
    const subscribedContacts = contacts.filter((c) => c.subscribed);
    if (subscribedContacts.length === 0) {
      toast.error(t("Tu n'as pas encore de contacts. Ajoute-les depuis l'onglet Emails."));
      return;
    }
    const willSend = allSubscribed
      ? subscribedContacts.length
      : selected.size;
    if (willSend === 0) {
      toast.error(t("Sélectionne au moins un destinataire"));
      return;
    }
    if (!confirm(t("Envoyer cet email à {n} destinataire(s) ?", { n: willSend }))) return;
    setSending(true);
    try {
      const r = await fetch(API(`/email/campaigns/${campaign.id}/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          allSubscribed
            ? { allSubscribed: true }
            : { contactIds: Array.from(selected) },
        ),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Oups" }));
        toast.error(t(friendlyError(err.error)));
        return;
      }
      const data: { sent: number; failed: number; total: number } = await r.json();
      onSent(data);
    } catch {
      toast.error(t("La connexion a coupé. On réessaie ?"));
    } finally {
      setSending(false);
    }
  }

  const subscribedCount = contacts.filter((c) => c.subscribed).length;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold">{t("Ton email est prêt ✨")}</h1>
        <p className="text-muted-foreground">{t("Relis, ajuste, choisis tes destinataires, puis on envoie.")}</p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">{t("Aperçu")}</h3>
          <Button variant={editing ? "secondary" : "ghost"} size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? t("Annuler") : t("Modifier")}
          </Button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("Sujet")}</Label>
              <input
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <Label className="text-xs">{t("Contenu du mail")}</Label>
              <Textarea
                className="mt-1 min-h-60"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("Écris ton message librement. Laisse une ligne vide entre deux paragraphes. C'est exactement ce texte qui sera envoyé.")}
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveEdits}>{t("Enregistrer")}</Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("Sujet")}</p>
              <p className="font-semibold text-lg">{campaign.subject}</p>
            </div>
            <div className="border rounded-lg p-4 bg-muted prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(campaign.bodyHtml) }}
            />
          </>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">{t("Expéditeur")}</h3>
        {sender?.usingOwnKey && sender.fromEmail ? (
          <p className="text-sm">
            {t("Cet email partira de")} <span className="font-semibold">{sender.fromName ? `${sender.fromName} ` : ""}&lt;{sender.fromEmail}&gt;</span>
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              {sender?.fromEmail ? (
                <>
                  {t("Cet email partira de")}{" "}
                  <span className="font-semibold">{sender.fromName ? `${sender.fromName} ` : ""}&lt;{sender.fromEmail}&gt;</span>{" "}
                  {t("(adresse partagée GrowIQ).")}{" "}
                </>
              ) : (
                <>{t("Cet email partira de l'adresse partagée GrowIQ.")}{" "}</>
              )}
              <Link href="/app/integrations" className="font-semibold underline">
                {t("Connecte ta propre adresse d'envoi")}
              </Link>{" "}
              {t("pour que tes emails partent à ton nom.")}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">{t("Pièces jointes")}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || attachments.length >= 3}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Ajout…")}</>
            ) : (
              <><Paperclip className="w-4 h-4 mr-2" /> {t("Ajouter un fichier")}</>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Aucune pièce jointe. Tu peux ajouter jusqu'à 3 fichiers (10 Mo max chacun).")}
          </p>
        ) : (
          <div className="border rounded-lg divide-y">
            {attachments.map((a, i) => (
              <div key={`${a.path}-${i}`} className="flex items-center gap-2 px-3 py-2">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{a.filename}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                <Button variant="ghost" size="sm" onClick={() => removeAttachment(i)} aria-label={t("Retirer")}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">{t("Destinataires")}</h3>
          <Link href="/app/emails" className="text-xs text-violet-600 hover:underline">
            {t("Gérer mes contacts")}
          </Link>
        </div>
        {loadingContacts ? (
          <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {t("Tu n'as pas encore de contacts.")} <Link href="/app/emails" className="text-violet-600 font-semibold hover:underline">{t("Ajoute-les")}</Link> {t("avant d'envoyer.")}
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSubscribed}
                onChange={(e) => {
                  setAllSubscribed(e.target.checked);
                  if (e.target.checked) setSelected(new Set());
                }}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                {t("Envoyer à tous mes abonnés ({count})", { count: subscribedCount })}
              </span>
            </label>
            {!allSubscribed && (
              <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
                {contacts.filter((c) => c.subscribed).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex-1">{c.email}</span>
                    {(c.firstName || c.lastName) && (
                      <span className="text-xs text-muted-foreground">{c.firstName} {c.lastName}</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>{t("← Retour au brief")}</Button>
        <Button
          onClick={send}
          disabled={sending || contacts.length === 0}
          className="h-12 px-8 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Envoi en cours…")}</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> {t("Envoyer maintenant")}</>
          )}
        </Button>
      </div>
    </div>
  );
}

function EmailSuccessScreen({
  campaign,
  result,
  onNew,
}: {
  campaign: EmailCampaignRow;
  result: { sent: number; failed: number; total: number };
  onNew: () => void;
}) {
  const t = useT();
  return (
    <div className="text-center space-y-6 py-10">
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/40 mx-auto">
        <CheckCircle2 className="w-14 h-14 text-white" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("Email envoyé !")}</h1>
        <p className="text-muted-foreground">
          {t("{sent} email(s) partis sur {total}.", { sent: result.sent, total: result.total })}
          {result.failed > 0 && ` ${t("{failed} échec(s).", { failed: result.failed })}`}
        </p>
        <p className="text-sm text-muted-foreground">
          « {campaign.subject} »
        </p>
      </div>
      <div className="flex justify-center gap-3 pt-2 flex-wrap">
        <Link href="/app/emails">
          <Button variant="outline" className="h-11">{t("Voir les stats")}</Button>
        </Link>
        <Button onClick={onNew} className="h-11 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
          <Wand2 className="w-4 h-4 mr-2" /> {t("En lancer une autre")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        {t("Les ouvertures et clics apparaîtront dans tes stats au fur et à mesure (si le webhook Resend est configuré).")}
      </p>
    </div>
  );
}
