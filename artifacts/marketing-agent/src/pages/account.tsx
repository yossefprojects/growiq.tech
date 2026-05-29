import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth, useUser, UserProfile } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  User as UserIcon,
  Building2,
  Sparkles,
  Plug,
  BarChart3,
  Shield,
  Lock,
  Save,
  Check,
  X,
  Facebook,
  Instagram,
  Linkedin,
  Megaphone,
  Mail,
  Trash2,
  AlertTriangle,
  Globe,
  ExternalLink,
  Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ────────────────────────────────────────────────────────────────

type BusinessProfile = {
  id: number | null;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  activity: string | null;
  targetAudience: string | null;
  companyWebsite: string | null;
  description: string | null;
  tone: string | null;
  language: string | null;
  primaryGoal: string | null;
  goals: string[];
  onboardingCompleted: boolean;
};

type Stats = {
  postsTotal: number;
  postsSent: number;
  agencyCampaigns: number;
  landingPages: number;
  leads: number;
  conversations: number;
  messages: number;
  adCampaigns: number;
  seoAudits: number;
  seoKeywordSets: number;
  seoContentPlans: number;
};

type AdsStatus = {
  meta: { configured: boolean; missing: string[] };
  google: { configured: boolean; missing: string[] };
};
type MetaStatus = { facebook: boolean; instagram: boolean };
type LinkedinStatus = {
  configured: boolean;
  connected: boolean;
  name?: string | null;
  email?: string | null;
  expired?: boolean;
};

// ── Constants ────────────────────────────────────────────────────────────

const TONES = [
  { id: "chaleureux", label: "Chaleureux & humain", desc: "Proche, bienveillant" },
  { id: "professionnel", label: "Professionnel", desc: "Sérieux, expert" },
  { id: "fun", label: "Fun & décalé", desc: "Léger, plein d'humour" },
  { id: "premium", label: "Premium & élégant", desc: "Raffiné, haut de gamme" },
  { id: "inspirant", label: "Inspirant", desc: "Motivant, énergique" },
];

const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "Anglais" },
  { id: "es", label: "Espagnol" },
];

const GOAL_OPTIONS = [
  { id: "notoriete", label: "Faire connaître ma marque" },
  { id: "clients", label: "Trouver de nouveaux clients" },
  { id: "ventes", label: "Vendre plus" },
  { id: "fidelisation", label: "Fidéliser mes clients" },
  { id: "communaute", label: "Construire une communauté" },
  { id: "trafic", label: "Augmenter le trafic web" },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function useAuthedFetch() {
  const { getToken } = useAuth();
  return async (path: string, init?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${basePath}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let msg = `HTTP ${res.status}`;
      try { const j = JSON.parse(body) as { error?: string }; if (j.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  };
}

// ── Section ──────────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 mb-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#5b54d6]/10 text-[#5b54d6] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{children}</label>;
}

function TextInput({
  value, onChange, placeholder, type = "text", testid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  testid?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b54d6]/30"
    />
  );
}

// ── Profile form ─────────────────────────────────────────────────────────

function ProfileForm({ profile }: { profile: BusinessProfile }) {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    businessName: profile.businessName ?? "",
    activity: profile.activity ?? "",
    companyWebsite: profile.companyWebsite ?? "",
    description: profile.description ?? "",
    targetAudience: profile.targetAudience ?? "",
  });

  const m = useMutation({
    mutationFn: () => af("/api/openai/business-profile", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-profile"] });
      toast.success("Profil enregistré");
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Prénom</Label>
          <TextInput value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} testid="input-first-name" />
        </div>
        <div>
          <Label>Nom</Label>
          <TextInput value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} testid="input-last-name" />
        </div>
      </div>
      <div>
        <Label>Nom de l'entreprise</Label>
        <TextInput value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} placeholder="Ma Petite Boutique" testid="input-business-name" />
      </div>
      <div>
        <Label>Secteur d'activité</Label>
        <TextInput value={form.activity} onChange={(v) => setForm({ ...form, activity: v })} placeholder="Ex : Boulangerie artisanale" testid="input-activity" />
      </div>
      <div>
        <Label>Site web</Label>
        <TextInput value={form.companyWebsite} onChange={(v) => setForm({ ...form, companyWebsite: v })} placeholder="https://monsite.com" testid="input-website" />
      </div>
      <div>
        <Label>Cible / clientèle</Label>
        <TextInput value={form.targetAudience} onChange={(v) => setForm({ ...form, targetAudience: v })} placeholder="Ex : Jeunes parents urbains" testid="input-target" />
      </div>
      <div>
        <Label>Description du business</Label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          placeholder="Ce que tu vends, ta différence, ton histoire en quelques phrases. Ces infos servent à personnaliser toutes les réponses de l'agent IA."
          data-testid="input-description"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b54d6]/30"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="inline-flex items-center gap-2 bg-[#5b54d6] hover:bg-[#4a44c4] text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          data-testid="button-save-profile"
        >
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Preferences ──────────────────────────────────────────────────────────

function PreferencesForm({ profile }: { profile: BusinessProfile }) {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [tone, setTone] = useState(profile.tone ?? "");
  const [language, setLanguage] = useState(profile.language ?? "fr");
  const [primaryGoal, setPrimaryGoal] = useState(profile.primaryGoal ?? "");
  const [goals, setGoals] = useState<string[]>(profile.goals ?? []);

  const toggle = (id: string) => {
    setGoals((g) => g.includes(id) ? g.filter((x) => x !== id) : [...g, id]);
  };

  const m = useMutation({
    mutationFn: () => af("/api/openai/business-profile", {
      method: "PUT",
      body: JSON.stringify({ tone, language, primaryGoal, goals }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-profile"] });
      toast.success("Préférences enregistrées");
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  return (
    <div className="space-y-5">
      <div>
        <Label>Ton de communication</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              data-testid={`tone-${t.id}`}
              className={cn(
                "text-left rounded-lg border p-3 transition-colors",
                tone === t.id ? "border-[#5b54d6] bg-[#5b54d6]/10" : "border-border/60 hover:border-[#5b54d6]/50",
              )}
            >
              <div className="font-semibold text-sm">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Langue préférée</Label>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id)}
              data-testid={`lang-${l.id}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                language === l.id ? "border-[#5b54d6] bg-[#5b54d6]/10 text-[#5b54d6] font-semibold" : "border-border/60 hover:border-[#5b54d6]/50",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Objectif principal</Label>
        <select
          value={primaryGoal}
          onChange={(e) => setPrimaryGoal(e.target.value)}
          data-testid="select-primary-goal"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— Aucun choisi —</option>
          {GOAL_OPTIONS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </div>

      <div>
        <Label>Autres objectifs (plusieurs possibles)</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((g) => {
            const on = goals.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggle(g.id)}
                data-testid={`goal-${g.id}`}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  on ? "border-[#3dbf8e] bg-[#3dbf8e]/15 text-[#1a7a55] font-semibold" : "border-border/60 hover:border-[#3dbf8e]/50",
                )}
              >
                {on && <Check className="w-3 h-3 inline mr-1" />}
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="inline-flex items-center gap-2 bg-[#5b54d6] hover:bg-[#4a44c4] text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          data-testid="button-save-preferences"
        >
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer les préférences
        </button>
      </div>
    </div>
  );
}

// ── Integrations ─────────────────────────────────────────────────────────

type IntegrationsStatus = {
  facebook: { connected: boolean; expired: boolean; label: string | null; displayName: string | null };
  instagram: { connected: boolean; expired: boolean; username: string | null };
  linkedin: { connected: boolean; expired: boolean; label: string | null; email: string | null };
  resend: { connected: boolean; fromEmail: string | null };
  metaAds: { connected: boolean; expired: boolean; adAccountName: string | null; currency: string | null };
  googleAds: { connected: boolean; expired: boolean; email: string | null; customerId: string | null };
};

function PlatformRow({
  icon: Icon, name, note, connected, expired,
  onConnect, onDisconnect, connectHref,
  busy, testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  note: string;
  connected: boolean;
  expired?: boolean;
  // Soit une action JS (déclenche OAuth), soit un lien wouter (page manuelle)
  onConnect?: () => void;
  onDisconnect?: () => void;
  connectHref?: string;
  busy?: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{name}</div>
          <div className="text-xs text-muted-foreground truncate">{note}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {connected ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#3dbf8e]/15 text-[#1a7a55] px-2 py-1 rounded-full">
              <Check className="w-3 h-3" /> Connecté
            </span>
            {onDisconnect && (
              <button
                onClick={onDisconnect}
                disabled={busy}
                data-testid={`button-${testId}-disconnect`}
                className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Déconnecter"}
              </button>
            )}
          </>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                expired ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700",
              )}
            >
              <X className="w-3 h-3" /> {expired ? "Jeton expiré" : "Non connecté"}
            </span>
            {onConnect ? (
              <button
                onClick={onConnect}
                disabled={busy}
                data-testid={`button-${testId}-connect`}
                className="inline-flex items-center gap-1 text-xs bg-[#0a66c2] hover:bg-[#0958a8] text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Connecter
              </button>
            ) : connectHref ? (
              <Link
                href={connectHref}
                data-testid={`link-${testId}-connect`}
                className="inline-flex items-center gap-1 text-xs bg-[#0a66c2] hover:bg-[#0958a8] text-white rounded-md px-3 py-1.5"
              >
                <ExternalLink className="w-3 h-3" /> Connecter
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function IntegrationsBlock() {
  const af = useAuthedFetch();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<IntegrationsStatus>({
    queryKey: ["integrations-status"],
    queryFn: () => af("/api/integrations") as Promise<IntegrationsStatus>,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["integrations-status"] });

  const startOAuth = async (path: string, label: string) => {
    // Petite fenêtre de connexion : l'utilisateur ne quitte jamais GrowIQ.
    // Ouverte de façon synchrone pour ne pas être bloquée par le navigateur.
    const popup = window.open(
      "about:blank",
      "growiq_oauth",
      "width=600,height=720,menubar=no,toolbar=no,location=no,status=no",
    );
    try {
      const r = await af(path) as { url?: string };
      if (!r?.url) {
        toast.error(`Pas d'URL de connexion ${label} reçue. Réessaie ou utilise la connexion manuelle.`);
        popup?.close();
        return;
      }
      if (!popup) {
        // Fenêtre bloquée d'emblée → on bascule sur l'onglet courant.
        window.location.href = r.url;
      } else if (!popup.closed) {
        popup.location.href = r.url;
      }
      // Si l'utilisateur a fermé la fenêtre avant la fin : on ne force rien.
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
      popup?.close();
    }
  };

  // Résultats envoyés par la petite fenêtre de connexion (popup).
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as
        | { source?: string; platform?: string; status?: string }
        | undefined;
      if (!d || d.source !== "growiq-oauth") return;
      const labels: Record<string, string> = {
        facebook: "Facebook",
        linkedin: "LinkedIn",
        google: "Google Ads",
      };
      const label = labels[d.platform ?? ""] ?? "Compte";
      if (d.status === "ok") toast.success(`${label} connecté !`);
      else if (d.status) toast.error(d.status);
      invalidate();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [invalidate]);

  const disconnect = useMutation({
    mutationFn: (vars: { platform: string; label: string }) =>
      af(`/api/integrations/${vars.platform}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => { invalidate(); toast.success(`${vars.label} déconnecté`); },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>;
  }

  const pendingPlatform = disconnect.isPending ? disconnect.variables?.platform : null;

  return (
    <div>
      <PlatformRow
        icon={Facebook}
        name="Facebook"
        note={data.facebook.connected
          ? `Connecté${data.facebook.label ? ` — ${data.facebook.label}` : ""}`
          : "Publier automatiquement sur ta page Facebook."}
        connected={data.facebook.connected}
        expired={data.facebook.expired}
        onConnect={() => startOAuth("/api/auth/facebook/start", "Facebook")}
        onDisconnect={() => disconnect.mutate({ platform: "meta", label: "Facebook & Instagram" })}
        busy={pendingPlatform === "meta"}
        testId="facebook"
      />
      <PlatformRow
        icon={Instagram}
        name="Instagram"
        note={data.instagram.connected
          ? `@${data.instagram.username ?? ""} connecté`
          : data.facebook.connected
            ? "Lie ton compte Instagram pro à ta page Facebook pour publier ici aussi."
            : "Connecte d'abord Facebook (Instagram est lié à ta page FB)."}
        connected={data.instagram.connected}
        expired={data.instagram.expired}
        // Instagram passe par l'OAuth Meta = même bouton que Facebook
        onConnect={data.facebook.connected ? undefined : () => startOAuth("/api/auth/facebook/start", "Facebook")}
        connectHref={data.facebook.connected ? "/app/integrations/facebook" : undefined}
        onDisconnect={() => disconnect.mutate({ platform: "meta", label: "Facebook & Instagram" })}
        busy={pendingPlatform === "meta"}
        testId="instagram"
      />
      <PlatformRow
        icon={Linkedin}
        name="LinkedIn"
        note={data.linkedin.connected
          ? `Connecté en tant que ${data.linkedin.label ?? data.linkedin.email ?? "toi"}`
          : "Publier automatiquement sur ton profil LinkedIn."}
        connected={data.linkedin.connected}
        expired={data.linkedin.expired}
        onConnect={() => startOAuth("/api/auth/linkedin/start", "LinkedIn")}
        onDisconnect={() => disconnect.mutate({ platform: "linkedin", label: "LinkedIn" })}
        busy={pendingPlatform === "linkedin"}
        testId="linkedin"
      />
      <PlatformRow
        icon={Megaphone}
        name="Meta Ads (Facebook payant)"
        note={data.metaAds.connected
          ? `${data.metaAds.adAccountName ?? "Compte publicitaire"}${data.metaAds.currency ? ` (${data.metaAds.currency})` : ""}`
          : data.facebook.connected
            ? "Renseigne ton compte publicitaire pour booster tes posts."
            : "Connecte d'abord Facebook, puis renseigne ton compte publicitaire."}
        connected={data.metaAds.connected}
        expired={data.metaAds.expired}
        // Pas d'OAuth dédié — renseignement manuel de l'Ad Account ID
        connectHref="/app/integrations/meta-ads"
        onDisconnect={() => disconnect.mutate({ platform: "meta_ads", label: "Meta Ads" })}
        busy={pendingPlatform === "meta_ads"}
        testId="meta-ads"
      />
      <PlatformRow
        icon={Megaphone}
        name="Google Ads"
        note={data.googleAds.connected
          ? data.googleAds.email ?? "Compte Google connecté"
          : "Lancer des campagnes Google Search depuis ton propre compte."}
        connected={data.googleAds.connected}
        expired={data.googleAds.expired}
        onConnect={() => startOAuth("/api/auth/google/start", "Google Ads")}
        onDisconnect={() => disconnect.mutate({ platform: "google_ads", label: "Google Ads" })}
        busy={pendingPlatform === "google_ads"}
        testId="google-ads"
      />
      <PlatformRow
        icon={Mail}
        name="Emailing"
        note={data.resend.connected
          ? `Ta clé Resend perso (${data.resend.fromEmail ?? "expéditeur configuré"})`
          : "Envoi des récapitulatifs et alertes via Resend (freemium 100/mois inclus)."}
        connected={true}
        // Déconnecter uniquement si l'user a configuré SA propre clé Resend.
        // En mode freemium (clé partagée GrowIQ), pas de déconnexion possible.
        onDisconnect={data.resend.connected
          ? () => disconnect.mutate({ platform: "resend", label: "Emailing" })
          : undefined}
        busy={pendingPlatform === "resend"}
        testId="email"
      />
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <div className="text-2xl font-extrabold text-[#5b54d6]">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function StatsBlock() {
  const af = useAuthedFetch();
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["me-stats"],
    queryFn: () => af("/api/me/stats") as Promise<Stats>,
  });
  if (isLoading || !data) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatTile value={data.postsSent} label="Posts publiés" />
      <StatTile value={data.postsTotal} label="Posts au total" />
      <StatTile value={data.agencyCampaigns} label="Campagnes" />
      <StatTile value={data.landingPages} label="Landing pages" />
      <StatTile value={data.leads} label="Leads collectés" />
      <StatTile value={data.conversations} label="Conversations" />
      <StatTile value={data.seoAudits + data.seoKeywordSets + data.seoContentPlans} label="Analyses SEO" />
      <StatTile value={data.adCampaigns} label="Campagnes payantes" />
    </div>
  );
}

// ── Danger zone ──────────────────────────────────────────────────────────

function DangerZone() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const m = useMutation({
    mutationFn: () => af("/api/me/data", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Toutes tes données ont été effacées");
      setConfirm("");
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h2 className="font-bold text-lg text-red-900">Zone sensible</h2>
      </div>
      <p className="text-sm text-red-900/80 mb-4">
        Effacer toutes tes données (profil business, conversations, posts programmés, landing pages, leads, campagnes, données SEO). Ton compte de connexion reste actif. <strong>Action irréversible.</strong>
      </p>
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <Label>Pour confirmer, tape « SUPPRIMER »</Label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          data-testid="input-delete-confirm"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
        />
        <button
          onClick={() => m.mutate()}
          disabled={confirm !== "SUPPRIMER" || m.isPending}
          data-testid="button-delete-data"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Effacer toutes mes données
        </button>
      </div>
    </div>
  );
}

// ── Clerk profile modal ──────────────────────────────────────────────────

function ClerkProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[880px] max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50 transition"
          aria-label="Fermer"
          data-testid="button-close-clerk-profile"
        >
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <div className="overflow-y-auto">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-none border-0 rounded-none",
                card: "w-full shadow-none border-0 rounded-none",
                navbar: "border-r border-gray-100 bg-white",
                navbarButton: "text-gray-700 hover:bg-gray-50",
                navbarButtonActive: "text-[#5b54d6] bg-[#5b54d6]/8",
                pageScrollBox: "px-6 py-6",
                profileSectionPrimaryButton: "text-[#5b54d6] hover:text-[#4842b5]",
                formButtonPrimary: "bg-[#5b54d6] hover:bg-[#4842b5] text-white",
              },
              variables: {
                colorPrimary: "#5b54d6",
                colorText: "#111827",
                colorBackground: "#ffffff",
                fontFamily: "inherit",
                borderRadius: "0.75rem",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Same shape as AdminGate in App.tsx so React Query dedupes correctly.
type AccountMeState =
  | { kind: "ok"; data: { userId: string; email: string | null; isAdmin: boolean } }
  | { kind: "unauthenticated" }
  | { kind: "network_error" };

function AdminCard() {
  const af = useAuthedFetch();
  const { data } = useQuery<AccountMeState>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const r = await af("/api/me") as { userId: string; email: string | null; isAdmin: boolean };
        return { kind: "ok", data: r };
      } catch {
        return { kind: "network_error" };
      }
    },
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = data?.kind === "ok" && data.data.isAdmin;
  if (!isAdmin) return null;
  return (
    <Link
      href="/app/admin"
      data-testid="link-admin-cta"
      className="block rounded-2xl border-2 border-[#5b54d6]/30 bg-gradient-to-br from-[#5b54d6]/8 to-[#ff7a3c]/8 p-5 sm:p-6 mb-5 hover:border-[#5b54d6]/60 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#5b54d6] text-white flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg">Admin CRM</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#5b54d6] text-white rounded-full px-2 py-0.5">Réservé admin</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Voir tous les utilisateurs inscrits, leurs projets et leurs campagnes.
          </p>
        </div>
        <ArrowLeft className="w-5 h-5 rotate-180 text-[#5b54d6] shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const af = useAuthedFetch();
  const [clerkOpen, setClerkOpen] = useState(false);
  const [location] = useLocation();

  // Retour du callback LinkedIn (?linkedin=ok|...)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const li = qs.get("linkedin");
    if (!li) return;
    // Si on est dans la petite fenêtre de connexion : prévenir la page
    // principale GrowIQ puis se fermer automatiquement.
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(
          { source: "growiq-oauth", platform: "linkedin", status: li },
          window.location.origin,
        );
      } catch {
        /* origines différentes : on ignore */
      }
      window.close();
      return;
    }
    if (li === "ok") toast.success("LinkedIn connecté avec succès");
    else toast.error(li);
    // Clean URL
    const cleaned = window.location.pathname;
    window.history.replaceState({}, "", cleaned);
  }, [location]);

  const profile = useQuery<BusinessProfile>({
    queryKey: ["business-profile"],
    queryFn: () => af("/api/openai/business-profile") as Promise<BusinessProfile>,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">Mon compte</h1>
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          Gère ton profil, tes préférences de communication et tes intégrations. Plus tu donnes d'infos, plus l'agent IA personnalise ses réponses pour toi.
        </p>

        {/* Identity header */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 mb-5">
          {!isLoaded ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[#5b54d6]/20" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#5b54d6]/15 text-[#5b54d6] flex items-center justify-center font-bold text-xl">
                  {(user?.primaryEmailAddress?.emailAddress?.[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg truncate">
                  {profile.data?.firstName || profile.data?.lastName
                    ? `${profile.data.firstName ?? ""} ${profile.data.lastName ?? ""}`.trim()
                    : (user?.fullName ?? "Bienvenue")}
                </div>
                <div className="text-sm text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
              <button
                onClick={() => setClerkOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm border border-border/60 hover:bg-muted rounded-md px-3 py-1.5"
                data-testid="button-open-clerk"
              >
                <Lock className="w-4 h-4" />
                Sécurité & email
              </button>
            </div>
          )}
        </section>

        <AdminCard />

        {/* Body */}
        {profile.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#5b54d6]" /></div>
        ) : !profile.data ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Impossible de charger ton profil.</div>
        ) : (
          <>
            <Section
              icon={Building2}
              title="Profil business"
              subtitle="Ces infos personnalisent les réponses de l'agent IA et le contenu généré."
            >
              <ProfileForm profile={profile.data} />
            </Section>

            <Section
              icon={Sparkles}
              title="Préférences de l'agent IA"
              subtitle="Choisis comment l'agent communique pour toi."
            >
              <PreferencesForm profile={profile.data} />
            </Section>

            <Section
              icon={Plug}
              title="Connexions & intégrations"
              subtitle="Quels services sont reliés à ton compte."
            >
              <IntegrationsBlock />
            </Section>

            <Section
              icon={BarChart3}
              title="Statistiques d'utilisation"
              subtitle="Aperçu de ton activité depuis l'inscription."
            >
              <StatsBlock />
            </Section>

            <DangerZone />
          </>
        )}
      </main>

      <ClerkProfileDialog open={clerkOpen} onClose={() => setClerkOpen(false)} />
    </div>
  );
}
