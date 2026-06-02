import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  ArrowLeft,
  Search,
  KeyRound,
  PenLine,
  CalendarRange,
  BarChart3,
  Loader2,
  Trash2,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { toastError } from "@/lib/toast-helpers";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── types ─────────────────────────────────────────────────────────────────

type SeoAudit = {
  id: number;
  url: string;
  score: number;
  createdAt: string;
  report: {
    title: { value: string | null; length: number; ok: boolean };
    metaDescription: { value: string | null; length: number; ok: boolean };
    h1: { count: number; samples: string[]; ok: boolean };
    h2: { count: number; samples: string[] };
    wordCount: number;
    images: { total: number; missingAlt: number };
    language: string | null;
    recommendations: { priority: "high" | "medium" | "low"; title: string; detail: string }[];
    summary: string;
  };
};

type SeoKeyword = {
  keyword: string;
  intent: string;
  difficulty: "facile" | "moyenne" | "difficile";
  estimatedVolume: "faible" | "moyen" | "élevé";
  rationale: string;
};

type SeoKeywordSetRow = {
  id: number;
  topic: string;
  audience: string | null;
  goal: string | null;
  createdAt: string;
  data: { keywords: SeoKeyword[]; summary: string };
};

type SeoContentPlanRow = {
  id: number;
  title: string;
  horizonDays: number;
  createdAt: string;
  plan: {
    summary: string;
    horizonDays: number;
    items: {
      week: number;
      day: number;
      type: "article" | "post-social" | "newsletter" | "video";
      title: string;
      targetKeyword: string;
      angle: string;
      expectedImpact: "fort" | "moyen" | "faible";
    }[];
  };
};

type SeoReport = {
  counters: {
    audits: number;
    keywordSets: number;
    keywords: number;
    contentPlans: number;
    plannedContents: number;
  };
  latestAudit: { id: number; url: string; score: number; createdAt: string } | null;
  scoreEvolution: number;
  nextActions: { title: string; reason: string }[];
};

// ── helpers ───────────────────────────────────────────────────────────────

function useAuthedFetch() {
  const { getToken } = useAuth();
  return async (path: string, init?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${basePath}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(body) as { error?: string };
        if (j.error) msg = j.error;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  };
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-[#3dbf8e]/15 text-[#1a7a55]" : score >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700";
  const label = score >= 80 ? "Bon" : score >= 60 ? "À améliorer" : "Faible";
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", color)}>
      {score}/100 · {label}
    </span>
  );
}

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const map = {
    high: { bg: "bg-red-100 text-red-700", label: "Priorité haute" },
    medium: { bg: "bg-amber-100 text-amber-800", label: "Priorité moyenne" },
    low: { bg: "bg-gray-100 text-gray-700", label: "Bonus" },
  };
  const m = map[priority];
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", m.bg)}>{m.label}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#3dbf8e]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

// ── tabs ──────────────────────────────────────────────────────────────────

type Tab = "audit" | "keywords" | "copy" | "plan" | "report";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "audit", label: "Audit URL", icon: Search },
  { id: "keywords", label: "Mots-clés", icon: KeyRound },
  { id: "copy", label: "Rédaction", icon: PenLine },
  { id: "plan", label: "Plan éditorial", icon: CalendarRange },
  { id: "report", label: "Rapport", icon: BarChart3 },
];

// ── AUDIT TAB ─────────────────────────────────────────────────────────────

function AuditTab() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");

  const { data: audits = [], isLoading } = useQuery<SeoAudit[]>({
    queryKey: ["seo-audits"],
    queryFn: () => af("/api/seo/audits") as Promise<SeoAudit[]>,
  });

  const runAudit = useMutation({
    mutationFn: (u: string) => af("/api/seo/audit", { method: "POST", body: JSON.stringify({ url: u }) }),
    onSuccess: () => {
      setUrl("");
      qc.invalidateQueries({ queryKey: ["seo-audits"] });
      qc.invalidateQueries({ queryKey: ["seo-report"] });
    },
    onError: (e) => toastError(e, "L'audit a échoué"),
  });

  const del = useMutation({
    mutationFn: (id: number) => af(`/api/seo/audits/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-audits"] }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-lg font-bold mb-1">Audit SEO d'une page</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Colle l'adresse complète d'une page de ton site. L'agent analyse les balises, le contenu et te donne une note avec des recommandations claires.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) runAudit.mutate(url.trim());
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="url"
            required
            placeholder="https://monsite.fr/ma-page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={runAudit.isPending}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b54d6]"
            data-testid="input-audit-url"
          />
          <button
            type="submit"
            disabled={runAudit.isPending || !url.trim()}
            className="inline-flex items-center justify-center gap-2 bg-[#5b54d6] hover:bg-[#4d46c4] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-2 text-sm font-semibold transition-colors"
            data-testid="button-run-audit"
          >
            {runAudit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {runAudit.isPending ? "Analyse en cours…" : "Lancer l'audit"}
          </button>
        </form>
        {runAudit.isPending && (
          <p className="text-xs text-muted-foreground mt-3">
            Récupération de la page + analyse IA — ça peut prendre 15 à 30 secondes.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" />
        </div>
      ) : audits.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-10">
          Aucun audit pour l'instant. Lance ton premier juste au-dessus.
        </div>
      ) : (
        <div className="space-y-4">
          {audits.map((a) => (
            <AuditCard key={a.id} audit={a} onDelete={() => del.mutate(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditCard({ audit, onDelete }: { audit: SeoAudit; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={audit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e1b4b] hover:text-[#5b54d6] truncate max-w-full"
          >
            <span className="truncate">{audit.url}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(audit.createdAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={audit.score} />
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
            {open ? "Réduire" : "Détails"}
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1" aria-label="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border/60 p-5 space-y-5 bg-muted/20">
          {audit.report.summary && (
            <p className="text-sm text-foreground italic">{audit.report.summary}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Titre" value={`${audit.report.title.length} car.`} ok={audit.report.title.ok} />
            <Metric label="Description" value={`${audit.report.metaDescription.length} car.`} ok={audit.report.metaDescription.ok} />
            <Metric label="H1" value={audit.report.h1.count.toString()} ok={audit.report.h1.ok} />
            <Metric label="Mots" value={audit.report.wordCount.toString()} ok={audit.report.wordCount >= 300} />
          </div>
          <div className="text-xs text-muted-foreground">
            Images : {audit.report.images.total} dont {audit.report.images.missingAlt} sans texte alternatif (alt).
            {audit.report.language && ` · Langue déclarée : ${audit.report.language}.`}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Recommandations</h4>
            {audit.report.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune recommandation détaillée disponible.</p>
            ) : (
              audit.report.recommendations.map((r, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold">{r.title}</span>
                    <PriorityPill priority={r.priority} />
                  </div>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={cn("rounded-lg p-3 border", ok ? "border-[#3dbf8e]/40 bg-[#3dbf8e]/5" : "border-amber-300 bg-amber-50")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

// ── KEYWORDS TAB ──────────────────────────────────────────────────────────

function KeywordsTab() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");

  const { data = [], isLoading } = useQuery<SeoKeywordSetRow[]>({
    queryKey: ["seo-keywords"],
    queryFn: () => af("/api/seo/keywords") as Promise<SeoKeywordSetRow[]>,
  });

  const gen = useMutation({
    mutationFn: () =>
      af("/api/seo/keywords", {
        method: "POST",
        body: JSON.stringify({ topic, audience, goal }),
      }),
    onSuccess: () => {
      setTopic(""); setAudience(""); setGoal("");
      qc.invalidateQueries({ queryKey: ["seo-keywords"] });
      qc.invalidateQueries({ queryKey: ["seo-report"] });
    },
    onError: (e) => toastError(e, "La génération a échoué"),
  });

  const del = useMutation({
    mutationFn: (id: number) => af(`/api/seo/keywords/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-keywords"] }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-lg font-bold mb-1">Trouver mes mots-clés</h3>
        <p className="text-sm text-muted-foreground mb-4">
          L'agent te propose 15-20 mots-clés à cibler. Les mots-clés que tu génères ici sont automatiquement utilisés par l'agence quand elle rédige tes posts Facebook/Instagram.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <textarea
            placeholder="Sujet ou activité (ex : pâtisserie artisanale à Lyon)"
            value={topic} onChange={(e) => setTopic(e.target.value)}
            disabled={gen.isPending}
            className="sm:col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
            data-testid="input-kw-topic"
          />
          <input
            placeholder="Cible (optionnel) — ex : jeunes parents"
            value={audience} onChange={(e) => setAudience(e.target.value)}
            disabled={gen.isPending}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Objectif (optionnel) — ex : ventes en ligne"
            value={goal} onChange={(e) => setGoal(e.target.value)}
            disabled={gen.isPending}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => topic.trim() && gen.mutate()}
          disabled={gen.isPending || !topic.trim()}
          className="mt-3 inline-flex items-center gap-2 bg-[#5b54d6] hover:bg-[#4d46c4] disabled:opacity-50 text-white rounded-md px-4 py-2 text-sm font-semibold"
          data-testid="button-generate-keywords"
        >
          {gen.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {gen.isPending ? "Génération…" : "Générer mes mots-clés"}
        </button>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          Volume et difficulté sont des estimations de l'IA, pas des données d'outils SEO professionnels.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-10">Aucune recherche pour l'instant.</div>
      ) : (
        data.map((set) => <KeywordSetCard key={set.id} set={set} onDelete={() => del.mutate(set.id)} />)
      )}
    </div>
  );
}

function KeywordSetCard({ set, onDelete }: { set: SeoKeywordSetRow; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="font-semibold truncate">{set.topic}</h4>
          <p className="text-xs text-muted-foreground">
            {new Date(set.createdAt).toLocaleString("fr-FR")} · {set.data.keywords.length} mots-clés
          </p>
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {set.data.summary && <p className="text-sm text-muted-foreground italic mb-3">{set.data.summary}</p>}
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <th className="px-5 py-2">Mot-clé</th>
              <th className="px-3 py-2">Intention</th>
              <th className="px-3 py-2">Difficulté</th>
              <th className="px-3 py-2">Volume estimé</th>
            </tr>
          </thead>
          <tbody>
            {set.data.keywords.map((k, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0">
                <td className="px-5 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span>{k.keyword}</span>
                    <CopyButton text={k.keyword} />
                  </div>
                  {k.rationale && <div className="text-[11px] text-muted-foreground mt-0.5">{k.rationale}</div>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{k.intent}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full",
                    k.difficulty === "facile" ? "bg-[#3dbf8e]/15 text-[#1a7a55]" :
                    k.difficulty === "moyenne" ? "bg-amber-100 text-amber-800" :
                    "bg-red-100 text-red-700"
                  )}>{k.difficulty}</span>
                </td>
                <td className="px-3 py-2 text-xs">{k.estimatedVolume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── COPY TAB ──────────────────────────────────────────────────────────────

type CopyType = "article" | "meta-description" | "title" | "alt";
const COPY_LABELS: Record<CopyType, string> = {
  article: "Article de blog",
  "meta-description": "Méta-description",
  title: "Titres SEO",
  alt: "Textes alternatifs (alt)",
};

function CopyTab() {
  const af = useAuthedFetch();
  const [type, setType] = useState<CopyType>("article");
  const [keyword, setKeyword] = useState("");
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<{ type: CopyType; keyword: string; result: Record<string, unknown> } | null>(null);

  const gen = useMutation({
    mutationFn: () =>
      af("/api/seo/copy", { method: "POST", body: JSON.stringify({ type, keyword, brief }) }) as Promise<{
        type: CopyType; keyword: string; result: Record<string, unknown>;
      }>,
    onSuccess: (r) => setResult(r),
    onError: (e) => toastError(e, "La rédaction a échoué"),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-lg font-bold mb-1">Rédaction optimisée SEO</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choisis ce que tu veux générer, donne le mot-clé cible (idéalement un mot-clé que tu as déjà recherché dans l'onglet précédent), et obtiens du texte prêt à copier.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {(Object.keys(COPY_LABELS) as CopyType[]).map((t) => (
            <button
              key={t} onClick={() => setType(t)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                type === t
                  ? "border-[#5b54d6] bg-[#5b54d6]/10 text-[#5b54d6]"
                  : "border-border/60 text-foreground hover:border-[#5b54d6]/40"
              )}
              data-testid={`button-copy-type-${t}`}
            >{COPY_LABELS[t]}</button>
          ))}
        </div>
        <input
          placeholder="Mot-clé cible (ex : pâtisserie sans gluten Lyon)"
          value={keyword} onChange={(e) => setKeyword(e.target.value)}
          disabled={gen.isPending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-2"
        />
        <textarea
          placeholder="Contexte (optionnel) : public visé, angle souhaité…"
          value={brief} onChange={(e) => setBrief(e.target.value)}
          disabled={gen.isPending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] mb-3"
        />
        <button
          onClick={() => keyword.trim() && gen.mutate()}
          disabled={gen.isPending || !keyword.trim()}
          className="inline-flex items-center gap-2 bg-[#5b54d6] hover:bg-[#4d46c4] disabled:opacity-50 text-white rounded-md px-4 py-2 text-sm font-semibold"
        >
          {gen.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {gen.isPending ? "Rédaction…" : "Rédiger"}
        </button>
      </div>

      {result && <CopyResult data={result} />}
    </div>
  );
}

function CopyResult({ data }: { data: { type: CopyType; keyword: string; result: Record<string, unknown> } }) {
  const r = data.result;
  if (data.type === "article") {
    const body = String(r["body"] ?? "");
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Article généré</div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Titre</div>
          <div className="font-semibold flex items-center gap-2">
            <span>{String(r["title"] ?? "")}</span>
            <CopyButton text={String(r["title"] ?? "")} />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Méta-description</div>
          <div className="text-sm flex items-start gap-2">
            <span className="flex-1">{String(r["metaDescription"] ?? "")}</span>
            <CopyButton text={String(r["metaDescription"] ?? "")} />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-2">
            Corps de l'article <CopyButton text={body} />
          </div>
          <pre className="whitespace-pre-wrap text-sm bg-muted/30 rounded-md p-3 max-h-96 overflow-auto font-sans">{body}</pre>
        </div>
      </div>
    );
  }
  const variants = Array.isArray(r["variants"]) ? (r["variants"] as string[]) : [];
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        {COPY_LABELS[data.type]} — propositions
      </div>
      <div className="space-y-2">
        {variants.map((v, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
            <span className="flex-1">{v}</span>
            <span className="text-xs text-muted-foreground">{v.length} car.</span>
            <CopyButton text={v} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PLAN TAB ──────────────────────────────────────────────────────────────

function PlanTab() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30);
  const [kwInput, setKwInput] = useState("");
  const [context, setContext] = useState("");

  const { data: keywordSets = [] } = useQuery<SeoKeywordSetRow[]>({
    queryKey: ["seo-keywords"],
    queryFn: () => af("/api/seo/keywords") as Promise<SeoKeywordSetRow[]>,
  });
  const { data: plans = [], isLoading } = useQuery<SeoContentPlanRow[]>({
    queryKey: ["seo-plans"],
    queryFn: () => af("/api/seo/plans") as Promise<SeoContentPlanRow[]>,
  });

  const allSuggested = keywordSets.flatMap((s) => s.data.keywords.map((k) => k.keyword));
  const [selected, setSelected] = useState<string[]>([]);

  const gen = useMutation({
    mutationFn: () => {
      const keywords = [...selected, ...kwInput.split(",").map((s) => s.trim()).filter(Boolean)];
      return af("/api/seo/plan", {
        method: "POST",
        body: JSON.stringify({ title, horizonDays: horizon, keywords, context }),
      });
    },
    onSuccess: () => {
      setTitle(""); setContext(""); setSelected([]); setKwInput("");
      qc.invalidateQueries({ queryKey: ["seo-plans"] });
      qc.invalidateQueries({ queryKey: ["seo-report"] });
    },
    onError: (e) => toastError(e, "La génération du plan a échoué"),
  });

  const del = useMutation({
    mutationFn: (id: number) => af(`/api/seo/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-plans"] }),
  });

  const toggle = (k: string) =>
    setSelected((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-lg font-bold mb-1">Calendrier éditorial SEO</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choisis tes mots-clés cibles et l'horizon, l'agent te propose un planning concret d'articles et de posts.
        </p>
        <input
          placeholder="Nom du plan (ex : Rentrée 2026)"
          value={title} onChange={(e) => setTitle(e.target.value)}
          disabled={gen.isPending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
        />
        <div className="flex gap-2 mb-3">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d} onClick={() => setHorizon(d)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium",
                horizon === d ? "border-[#5b54d6] bg-[#5b54d6]/10 text-[#5b54d6]" : "border-border/60"
              )}
            >{d} jours</button>
          ))}
        </div>
        {allSuggested.length > 0 && (
          <div className="mb-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Mots-clés disponibles (clique pour sélectionner)
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
              {[...new Set(allSuggested)].map((k) => (
                <button
                  key={k} onClick={() => toggle(k)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selected.includes(k)
                      ? "border-[#5b54d6] bg-[#5b54d6] text-white"
                      : "border-border/60 hover:border-[#5b54d6]/40"
                  )}
                >{k}</button>
              ))}
            </div>
          </div>
        )}
        <input
          placeholder="Mots-clés supplémentaires (séparés par des virgules)"
          value={kwInput} onChange={(e) => setKwInput(e.target.value)}
          disabled={gen.isPending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
        />
        <textarea
          placeholder="Contexte (optionnel)"
          value={context} onChange={(e) => setContext(e.target.value)}
          disabled={gen.isPending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] mb-3"
        />
        <button
          onClick={() => title.trim() && gen.mutate()}
          disabled={gen.isPending || !title.trim() || (selected.length === 0 && !kwInput.trim())}
          className="inline-flex items-center gap-2 bg-[#5b54d6] hover:bg-[#4d46c4] disabled:opacity-50 text-white rounded-md px-4 py-2 text-sm font-semibold"
        >
          {gen.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {gen.isPending ? "Génération…" : "Générer le plan"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-10">Pas encore de plan éditorial.</div>
      ) : (
        plans.map((p) => <PlanCard key={p.id} plan={p} onDelete={() => del.mutate(p.id)} />)
      )}
    </div>
  );
}

function PlanCard({ plan, onDelete }: { plan: SeoContentPlanRow; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h4 className="font-semibold">{plan.title}</h4>
          <p className="text-xs text-muted-foreground">
            {plan.horizonDays} jours · {plan.plan.items.length} contenus · {new Date(plan.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {plan.plan.summary && <p className="text-sm text-muted-foreground italic mb-3">{plan.plan.summary}</p>}
      <div className="space-y-1.5">
        {plan.plan.items.map((it, i) => (
          <div key={i} className="flex items-start gap-3 rounded-md border border-border/40 px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground shrink-0 w-20">
              S{it.week}·J{it.day}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{it.title}</div>
              <div className="text-xs text-muted-foreground">
                {it.type} · mot-clé : <span className="font-medium">{it.targetKeyword}</span>
              </div>
              {it.angle && <div className="text-xs text-muted-foreground/80 mt-0.5">{it.angle}</div>}
            </div>
            <span className={cn(
              "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
              it.expectedImpact === "fort" ? "bg-[#3dbf8e]/15 text-[#1a7a55]" :
              it.expectedImpact === "moyen" ? "bg-amber-100 text-amber-800" :
              "bg-gray-100 text-gray-700"
            )}>{it.expectedImpact}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REPORT TAB ────────────────────────────────────────────────────────────

function ReportTab() {
  const af = useAuthedFetch();
  const { data, isLoading } = useQuery<SeoReport>({
    queryKey: ["seo-report"],
    queryFn: () => af("/api/seo/report") as Promise<SeoReport>,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#5b54d6]" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Audits réalisés" value={data.counters.audits} />
        <Stat label="Recherches mots-clés" value={data.counters.keywordSets} />
        <Stat label="Mots-clés ciblés" value={data.counters.keywords} />
        <Stat label="Contenus planifiés" value={data.counters.plannedContents} />
      </div>

      {data.latestAudit && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Dernier audit</div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold truncate">{data.latestAudit.url}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(data.latestAudit.createdAt).toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ScoreBadge score={data.latestAudit.score} />
              {data.scoreEvolution !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-sm font-semibold",
                  data.scoreEvolution > 0 ? "text-[#1a7a55]" : "text-red-600"
                )}>
                  <TrendingUp className={cn("w-4 h-4", data.scoreEvolution < 0 && "rotate-180")} />
                  {data.scoreEvolution > 0 ? "+" : ""}{data.scoreEvolution} pts
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="text-lg font-bold mb-3">Prochaines actions recommandées</h3>
        {data.nextActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tout est en ordre — continue à produire du contenu régulièrement et relance un audit dans 4 à 6 semaines pour mesurer les progrès.
          </p>
        ) : (
          <ol className="space-y-2">
            {data.nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#5b54d6] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div>
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.reason}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        Astuce : tes mots-clés générés dans l'onglet « Mots-clés » sont automatiquement utilisés par l'agence quand elle rédige tes posts Facebook et Instagram.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────

export default function SeoPage() {
  const [tab, setTab] = useState<Tab>("audit");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
          <LanguageSwitcher />
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">SEO — référencement naturel</h1>
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          Tout ce qu'il faut pour être trouvé sur Google : analyse de ton site, recherche de mots-clés, rédaction optimisée et calendrier éditorial.
        </p>

        <div className="flex flex-wrap gap-1 mb-6 border-b border-border/60">
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-[#5b54d6] text-[#5b54d6]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "audit" && <AuditTab />}
        {tab === "keywords" && <KeywordsTab />}
        {tab === "copy" && <CopyTab />}
        {tab === "plan" && <PlanTab />}
        {tab === "report" && <ReportTab />}
      </main>
    </div>
  );
}
