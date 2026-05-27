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
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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

function IntegrationRow({
  icon: Icon, name, connected, note, ctaLabel, ctaHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  connected: boolean;
  note?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{name}</div>
          {note && <div className="text-xs text-muted-foreground truncate">{note}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {connected ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#3dbf8e]/15 text-[#1a7a55] px-2 py-1 rounded-full">
            <Check className="w-3 h-3" /> Connecté
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
            <X className="w-3 h-3" /> Non connecté
          </span>
        )}
        {ctaHref && (
          <Link
            href={ctaHref}
            className="text-xs text-[#5b54d6] hover:underline whitespace-nowrap"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function LinkedinRow() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<LinkedinStatus>({
    queryKey: ["linkedin-status"],
    queryFn: () => af("/api/linkedin/status") as Promise<LinkedinStatus>,
  });

  const connect = useMutation({
    mutationFn: () => af("/api/auth/linkedin/start") as Promise<{ url: string }>,
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });
  const disconnect = useMutation({
    mutationFn: () => af("/api/linkedin/disconnect", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linkedin-status"] });
      toast.success("LinkedIn déconnecté");
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40">
        <div className="flex items-center gap-3"><Linkedin className="w-5 h-5 text-muted-foreground" /><div className="font-medium text-sm">LinkedIn</div></div>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status: { kind: "ok" | "warn" | "err"; label: string } = !data.configured
    ? { kind: "err", label: "Non configuré" }
    : data.connected && data.expired
    ? { kind: "warn", label: "Jeton expiré" }
    : data.connected
    ? { kind: "ok", label: "Connecté" }
    : { kind: "err", label: "Non connecté" };

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40">
      <div className="flex items-center gap-3 min-w-0">
        <Linkedin className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">LinkedIn</div>
          <div className="text-xs text-muted-foreground truncate">
            {data.connected ? `Connecté en tant que ${data.name ?? data.email ?? "toi"}` : "Publier automatiquement sur ton profil LinkedIn."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          status.kind === "ok" && "bg-[#3dbf8e]/15 text-[#1a7a55]",
          status.kind === "warn" && "bg-amber-100 text-amber-800",
          status.kind === "err" && "bg-red-100 text-red-700",
        )}>
          {status.kind === "ok" ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {status.label}
        </span>
        {data.configured && (data.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            data-testid="button-linkedin-disconnect"
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Déconnecter
          </button>
        ) : (
          <button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            data-testid="button-linkedin-connect"
            className="inline-flex items-center gap-1 text-xs bg-[#0a66c2] hover:bg-[#0958a8] text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {connect.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
            Connecter
          </button>
        ))}
      </div>
    </div>
  );
}

function IntegrationsBlock() {
  const af = useAuthedFetch();
  const meta = useQuery<MetaStatus>({
    queryKey: ["meta-status"],
    queryFn: () => af("/api/meta/status") as Promise<MetaStatus>,
  });
  const ads = useQuery<AdsStatus>({
    queryKey: ["ads-status"],
    queryFn: () => af("/api/ads/status") as Promise<AdsStatus>,
  });
  if (meta.isLoading || ads.isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>;
  }
  return (
    <div>
      <IntegrationRow
        icon={Facebook}
        name="Facebook (publication gratuite)"
        connected={!!meta.data?.facebook}
        note="Publier automatiquement des posts sur ta page Facebook."
      />
      <IntegrationRow
        icon={Instagram}
        name="Instagram (publication gratuite)"
        connected={!!meta.data?.instagram}
        note="Publier automatiquement sur ton compte Instagram pro."
      />
      <LinkedinRow />
      <IntegrationRow
        icon={Megaphone}
        name="Meta Ads (Facebook payant)"
        connected={!!ads.data?.meta.configured}
        note={ads.data?.meta.configured ? "Tu peux booster des posts en publicité." : "En attente de la validation Meta."}
        ctaLabel="Détails →"
        ctaHref="/app/integrations"
      />
      <IntegrationRow
        icon={Megaphone}
        name="Google Ads"
        connected={!!ads.data?.google.configured}
        note={ads.data?.google.configured ? "Tu peux lancer des campagnes Google Search." : "En attente de la validation Google."}
        ctaLabel="Détails →"
        ctaHref="/app/integrations"
      />
      <IntegrationRow
        icon={Mail}
        name="Emails transactionnels"
        connected={true}
        note="Envoi des récapitulatifs et alertes via Resend."
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}

function AdminCard() {
  const af = useAuthedFetch();
  const { data } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["me"],
    queryFn: () => af("/api/me") as Promise<{ isAdmin: boolean }>,
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.isAdmin) return null;
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

  // Toast on return from LinkedIn OAuth callback (?linkedin=ok|...)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const li = qs.get("linkedin");
    if (!li) return;
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
