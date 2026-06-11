import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Globe, PenLine, CheckCircle2, Circle, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type CampaignType = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

export const CAMPAIGN_TYPES: CampaignType[] = [
  { id: "content", label: "Marketing de Contenu", icon: "📝", description: "Articles, e-books, infographies, newsletters" },
  { id: "seo", label: "SEO", icon: "🔍", description: "Stratégie de référencement naturel" },
  { id: "social", label: "Réseaux Sociaux", icon: "📱", description: "Posts, Reels, calendrier éditorial" },
  { id: "email", label: "E-mailing", icon: "📧", description: "Séquences email, newsletters" },
  { id: "pr", label: "Relations Publiques", icon: "📰", description: "Communiqués, guerilla marketing" },
  { id: "local", label: "Marketing Local", icon: "📍", description: "Google Business Profile, avis clients" },
  { id: "referral", label: "Bouche-à-oreille", icon: "🤝", description: "Programme de parrainage, ambassadeurs" },
];

type Step = "mode" | "url" | "analyzing" | "select" | "type" | "form" | "generating";

interface SuggestedCampaign {
  id: string;
  title: string;
  reasoning: string;
  priority: number;
}

interface GenerationTask {
  type: string;
  label: string;
  icon: string;
  status: "pending" | "generating" | "done" | "error";
  conversationId?: number;
}

interface BusinessForm {
  businessName: string;
  sector: string;
  audience: string;
  objective: string;
  tone: string;
  extra: string;
}

interface CampaignLaunchModalProps {
  open: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

export function CampaignLaunchModal({ open, onClose, onCampaignCreated }: CampaignLaunchModalProps) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [suggestedCampaigns, setSuggestedCampaigns] = useState<SuggestedCampaign[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState(""); // manual mode single type
  const [showBusinessEdit, setShowBusinessEdit] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [generationTasks, setGenerationTasks] = useState<GenerationTask[]>([]);
  const [form, setForm] = useState<BusinessForm>({
    businessName: "",
    sector: "",
    audience: "",
    objective: "",
    tone: "professionnel",
    extra: "",
  });
  const abortRef = useRef<AbortController | null>(null);

  const selectedTypeObj = CAMPAIGN_TYPES.find((t) => t.id === selectedType);

  const handleClose = () => {
    abortRef.current?.abort();
    setStep("mode");
    setMode("url");
    setUrl("");
    setSuggestedCampaigns([]);
    setSelectedTypes(new Set());
    setSelectedType("");
    setStreamingText("");
    setGenerationTasks([]);
    setShowBusinessEdit(false);
    setForm({ businessName: "", sector: "", audience: "", objective: "", tone: "professionnel", extra: "" });
    onClose();
  };

  // ── URL Analysis ─────────────────────────────────────────────────────────
  const handleAnalyzeUrl = async () => {
    if (!url.trim()) return;
    setStep("analyzing");
    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/openai/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!response.ok) throw new Error("Analyse échouée");
      const data = await response.json();

      if (data.businessInfo) {
        setForm({
          businessName: data.businessInfo.name ?? "",
          sector: data.businessInfo.sector ?? "",
          audience: data.businessInfo.audience ?? "",
          objective: data.businessInfo.objective ?? "",
          tone: data.businessInfo.tone ?? "professionnel",
          extra: `Site web : ${url}`,
        });
      }
      if (data.suggestedCampaigns?.length) {
        const sorted = [...data.suggestedCampaigns].sort((a, b) => a.priority - b.priority);
        setSuggestedCampaigns(sorted);
        setSelectedTypes(new Set(sorted.map((c: SuggestedCampaign) => c.id)));
      }
      setStep("select");
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Impossible d'analyser ce site. Vérifiez l'URL et réessayez.");
        setStep("url");
      }
    }
  };

  // ── Toggle campaign selection ─────────────────────────────────────────────
  const toggleCampaign = (id: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTypes.size === suggestedCampaigns.length) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(suggestedCampaigns.map((c) => c.id)));
    }
  };

  // ── Single campaign generation (manual mode) ─────────────────────────────
  const handleGenerateSingle = async () => {
    const title = `${selectedTypeObj?.label} — ${form.businessName}`;
    setStep("generating");
    setStreamingText("");
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/openai/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({ title, type: selectedType, businessContext: form }),
      });
      if (!response.ok) throw new Error("Génération échouée");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let conversationId: number | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) setStreamingText((prev) => prev + data.content);
                if (data.done && data.conversationId) conversationId = data.conversationId;
              } catch (_) {}
            }
          }
        }
      }

      onCampaignCreated();
      handleClose();
      if (conversationId) setLocation(`/app/conversations/${conversationId}`);
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Erreur lors de la génération");
        setStep("form");
      }
    }
  };

  // ── Multi-campaign generation (URL mode) ─────────────────────────────────
  const handleGenerateMulti = async () => {
    const typesToGenerate = suggestedCampaigns
      .filter((c) => selectedTypes.has(c.id))
      .map((c) => {
        const typeInfo = CAMPAIGN_TYPES.find((t) => t.id === c.id);
        return { type: c.id, label: typeInfo?.label ?? c.title, icon: typeInfo?.icon ?? "📋" };
      });

    if (!typesToGenerate.length) {
      toast.error("Sélectionnez au moins une campagne");
      return;
    }

    const tasks: GenerationTask[] = typesToGenerate.map((t) => ({ ...t, status: "pending" }));
    setGenerationTasks(tasks);
    setStep("generating");

    let lastConversationId: number | null = null;

    for (let i = 0; i < tasks.length; i++) {
      setGenerationTasks((prev) =>
        prev.map((t, idx) => (idx === i ? { ...t, status: "generating" } : t))
      );

      try {
        const title = `${tasks[i].label} — ${form.businessName}`;
        const response = await fetch("/api/openai/campaigns/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, type: tasks[i].type, businessContext: form }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value, { stream: true }).split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.done && data.conversationId) lastConversationId = data.conversationId;
                } catch (_) {}
              }
            }
          }
        }

        setGenerationTasks((prev) =>
          prev.map((t, idx) =>
            idx === i ? { ...t, status: "done", conversationId: lastConversationId ?? undefined } : t
          )
        );
      } catch (err) {
        console.warn(`Génération campagne ${tasks[i].type} échouée:`, err);
        setGenerationTasks((prev) =>
          prev.map((t, idx) => (idx === i ? { ...t, status: "error" } : t))
        );
      }
    }

    onCampaignCreated();
  };

  const allDone = generationTasks.length > 0 && generationTasks.every((t) => t.status === "done" || t.status === "error");
  const doneCount = generationTasks.filter((t) => t.status === "done").length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">

        {/* ── MODE SELECTION ── */}
        {step === "mode" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Lancer une campagne marketing gratuite</DialogTitle>
              <p className="text-sm text-muted-foreground">Comment souhaitez-vous démarrer ?</p>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <button
                onClick={() => { setMode("url"); setStep("url"); }}
                className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/60 hover:bg-primary/5 transition-all text-left group"
                data-testid="mode-url"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Promouvoir mon site web</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Collez une URL — l'agent analyse votre site et vous propose les campagnes les plus adaptées avec son raisonnement.
                  </p>
                </div>
              </button>
              <button
                onClick={() => { setMode("manual"); setStep("type"); }}
                className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/60 hover:bg-primary/5 transition-all text-left group"
                data-testid="mode-manual"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                  <PenLine className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Créer une campagne</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choisissez un type de campagne et renseignez votre contexte business pour générer tous les livrables.
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* ── URL INPUT ── */}
        {step === "url" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> Promouvoir mon site web
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                L'agent va analyser votre site et sélectionner les meilleures campagnes gratuites pour le promouvoir.
              </p>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <Label htmlFor="site-url">URL de votre site *</Label>
              <div className="flex gap-2">
                <Input
                  id="site-url"
                  placeholder="https://www.votresite.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && url.trim() && handleAnalyzeUrl()}
                  data-testid="input-url"
                  className="flex-1"
                />
                <Button
                  onClick={handleAnalyzeUrl}
                  disabled={!url.trim()}
                  data-testid="button-analyze"
                >
                  Analyser →
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                L'agent détecte automatiquement votre secteur, votre cible et les campagnes les plus pertinentes.
              </p>
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="ghost" onClick={() => setStep("mode")}>← Retour</Button>
            </div>
          </>
        )}

        {/* ── ANALYZING ── */}
        {step === "analyzing" && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Analyse du site en cours…</p>
              <p className="text-sm text-muted-foreground mt-1">
                L'agent scrute votre site pour détecter votre secteur, votre audience et les meilleures opportunités marketing.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{url}</p>
          </div>
        )}

        {/* ── CAMPAIGN SELECTION (URL mode) ── */}
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Choisissez vos campagnes</DialogTitle>
              <p className="text-sm text-muted-foreground">
                L'agent a analysé votre site et recommande ces campagnes, triées par pertinence.
              </p>
            </DialogHeader>

            {/* Detected business info */}
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <button
                className="w-full flex items-center justify-between text-sm font-medium text-foreground"
                onClick={() => setShowBusinessEdit(!showBusinessEdit)}
              >
                <span>🏢 Informations détectées : <span className="text-primary">{form.businessName}</span> — {form.sector}</span>
                {showBusinessEdit ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showBusinessEdit && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nom / Marque</Label>
                    <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Secteur</Label>
                    <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Cible / Audience</Label>
                    <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Objectif principal</Label>
                    <Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* Campaign selection */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">
                  {selectedTypes.size} campagne{selectedTypes.size > 1 ? "s" : ""} sélectionnée{selectedTypes.size > 1 ? "s" : ""}
                </p>
                <button
                  onClick={toggleAll}
                  className="text-xs text-primary hover:underline"
                  data-testid="button-toggle-all"
                >
                  {selectedTypes.size === suggestedCampaigns.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="space-y-2">
                {suggestedCampaigns.map((camp, idx) => {
                  const typeInfo = CAMPAIGN_TYPES.find((t) => t.id === camp.id);
                  const isSelected = selectedTypes.has(camp.id);
                  return (
                    <button
                      key={camp.id}
                      onClick={() => toggleCampaign(camp.id)}
                      data-testid={`campaign-select-${camp.id}`}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30"
                      )}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{typeInfo?.icon}</span>
                          <span className="font-semibold text-sm text-foreground">{typeInfo?.label ?? camp.title}</span>
                          {idx === 0 && (
                            <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                              ⭐ Priorité
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{camp.reasoning}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <Button
                onClick={handleGenerateMulti}
                disabled={selectedTypes.size === 0}
                className="w-full"
                data-testid="button-generate-selected"
              >
                ✨ Générer {selectedTypes.size} campagne{selectedTypes.size > 1 ? "s" : ""} sélectionnée{selectedTypes.size > 1 ? "s" : ""}
              </Button>
              <Button variant="ghost" onClick={() => setStep("url")} className="w-full">
                ← Changer d'URL
              </Button>
            </div>
          </>
        )}

        {/* ── CAMPAIGN TYPE PICKER (manual mode) ── */}
        {step === "type" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Choisissez le type de campagne</DialogTitle>
              <p className="text-sm text-muted-foreground">L'agent génère tous les livrables prêts à l'emploi.</p>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {CAMPAIGN_TYPES.map((type) => (
                <button
                  key={type.id}
                  data-testid={`campaign-type-${type.id}`}
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:border-primary/60 hover:bg-primary/5",
                    selectedType === type.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card"
                  )}
                >
                  <span className="text-2xl flex-shrink-0">{type.icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between gap-2 mt-4">
              <Button variant="ghost" onClick={() => setStep("mode")}>← Retour</Button>
              <Button
                onClick={() => setStep("form")}
                disabled={!selectedType}
                data-testid="button-next-step"
              >
                Suivant →
              </Button>
            </div>
          </>
        )}

        {/* ── BUSINESS FORM (manual mode) ── */}
        {step === "form" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedTypeObj?.icon}</span>
                <DialogTitle className="text-xl">{selectedTypeObj?.label}</DialogTitle>
              </div>
              <p className="text-sm text-muted-foreground">Renseignez votre contexte — l'agent génère tous les livrables sur mesure.</p>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="businessName">Nom de l'entreprise / marque *</Label>
                  <Input
                    id="businessName"
                    placeholder="ex: Maison Dupont"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sector">Secteur d'activité *</Label>
                  <Input
                    id="sector"
                    placeholder="ex: Restauration, E-commerce mode"
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    data-testid="input-sector"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="audience">Cible / Persona *</Label>
                <Input
                  id="audience"
                  placeholder="ex: Femmes 25-40 ans, CSP+, intéressées par le bien-être"
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  data-testid="input-audience"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="objective">Objectif principal *</Label>
                <Input
                  id="objective"
                  placeholder="ex: Augmenter le trafic web, générer des leads, fidéliser"
                  value={form.objective}
                  onChange={(e) => setForm({ ...form, objective: e.target.value })}
                  data-testid="input-objective"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tone">Ton de communication</Label>
                <select
                  id="tone"
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="select-tone"
                >
                  <option value="professionnel">Professionnel</option>
                  <option value="décontracté">Décontracté / Friendly</option>
                  <option value="inspirant">Inspirant / Motivant</option>
                  <option value="expert">Expert / Autoritaire</option>
                  <option value="humoristique">Humoristique</option>
                  <option value="luxe">Premium / Luxe</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="extra">Informations supplémentaires <span className="text-muted-foreground">(optionnel)</span></Label>
                <Textarea
                  id="extra"
                  placeholder="Budget, contraintes, produits phares, valeurs de marque..."
                  value={form.extra}
                  onChange={(e) => setForm({ ...form, extra: e.target.value })}
                  className="resize-none"
                  rows={3}
                  data-testid="textarea-extra"
                />
              </div>
            </div>
            <div className="flex justify-between gap-2 mt-4">
              <Button variant="ghost" onClick={() => setStep("type")}>← Retour</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleClose}>Annuler</Button>
                <Button
                  onClick={handleGenerateSingle}
                  disabled={!form.businessName || !form.sector || !form.audience || !form.objective}
                  data-testid="button-generate-campaign"
                >
                  ✨ Générer la campagne
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── GENERATING (single — manual mode) ── */}
        {step === "generating" && generationTasks.length === 0 && (
          <div className="py-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedTypeObj?.icon}</span>
                <div>
                  <DialogTitle>Génération en cours…</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">L'agent crée tous vos livrables et visuels. Cela prend 30-90 secondes.</p>
                </div>
              </div>
            </DialogHeader>
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 max-h-[420px] overflow-y-auto">
              {streamingText ? (
                <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none leading-relaxed [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Démarrage de la génération…</p>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              L'agent rédige vos livrables…
            </div>
          </div>
        )}

        {/* ── GENERATING (multi — URL mode) ── */}
        {step === "generating" && generationTasks.length > 0 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {allDone ? `✅ ${doneCount} campagne${doneCount > 1 ? "s" : ""} générée${doneCount > 1 ? "s" : ""} !` : "Génération en cours…"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {allDone
                  ? "Retrouvez vos campagnes dans la barre latérale."
                  : `${doneCount} / ${generationTasks.length} campagnes terminées…`}
              </p>
            </DialogHeader>

            {/* Progress bar */}
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${generationTasks.length ? (doneCount / generationTasks.length) * 100 : 0}%` }}
              />
            </div>

            {/* Task list */}
            <div className="mt-4 space-y-2">
              {generationTasks.map((task) => (
                <div
                  key={task.type}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all",
                    task.status === "done" ? "border-green-500/30 bg-green-500/5" :
                    task.status === "generating" ? "border-primary/40 bg-primary/5" :
                    task.status === "error" ? "border-destructive/30 bg-destructive/5" :
                    "border-border bg-card opacity-60"
                  )}
                >
                  <span className="text-xl flex-shrink-0">{task.icon}</span>
                  <span className="flex-1 text-sm font-medium text-foreground">{task.label}</span>
                  <div className="flex-shrink-0">
                    {task.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {task.status === "generating" && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                    {task.status === "error" && <AlertCircle className="w-5 h-5 text-destructive" />}
                    {task.status === "pending" && <Circle className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>

            {allDone && (
              <Button onClick={handleClose} className="w-full mt-4" data-testid="button-done">
                Voir mes campagnes →
              </Button>
            )}
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
