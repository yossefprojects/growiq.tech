import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type CampaignType = {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
};

export const CAMPAIGN_TYPES: CampaignType[] = [
  { id: "content", label: "Marketing de Contenu", icon: "📝", description: "Articles, e-books, infographies, newsletters", color: "violet" },
  { id: "seo", label: "SEO", icon: "🔍", description: "Stratégie de référencement naturel", color: "blue" },
  { id: "social", label: "Réseaux Sociaux", icon: "📱", description: "Posts, Reels, calendrier éditorial", color: "pink" },
  { id: "email", label: "E-mailing", icon: "📧", description: "Séquences email, newsletters", color: "amber" },
  { id: "pr", label: "Relations Publiques", icon: "📰", description: "Communiqués, guerilla marketing", color: "green" },
  { id: "local", label: "Marketing Local", icon: "📍", description: "Google Business Profile, avis clients", color: "red" },
  { id: "referral", label: "Bouche-à-oreille", icon: "🤝", description: "Programme de parrainage, ambassadeurs", color: "teal" },
];

interface CampaignLaunchModalProps {
  open: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

type Step = "type" | "form" | "generating";

export function CampaignLaunchModal({ open, onClose, onCampaignCreated }: CampaignLaunchModalProps) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<string>("");
  const [streamingText, setStreamingText] = useState("");
  const [form, setForm] = useState({
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
    if (step === "generating") {
      abortRef.current?.abort();
    }
    setStep("type");
    setSelectedType("");
    setStreamingText("");
    setForm({ businessName: "", sector: "", audience: "", objective: "", tone: "professionnel", extra: "" });
    onClose();
  };

  const handleGenerate = async () => {
    if (!selectedType || !form.businessName || !form.sector || !form.audience || !form.objective) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

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

      if (!response.ok) throw new Error("Erreur lors de la génération");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let conversationId: number | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  setStreamingText((prev) => prev + data.content);
                }
                if (data.done && data.conversationId) {
                  conversationId = data.conversationId;
                }
              } catch (_) {}
            }
          }
        }
      }

      onCampaignCreated();
      handleClose();

      if (conversationId) {
        setLocation(`/conversations/${conversationId}`);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Erreur lors de la génération de la campagne");
        setStep("form");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {step === "type" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Lancer une campagne gratuite</DialogTitle>
              <p className="text-sm text-muted-foreground">Choisissez le type de campagne que l'agent va créer pour vous.</p>
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
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={handleClose}>Annuler</Button>
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
                  onClick={handleGenerate}
                  disabled={!form.businessName || !form.sector || !form.audience || !form.objective}
                  data-testid="button-generate-campaign"
                >
                  ✨ Générer la campagne
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "generating" && (
          <div className="py-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedTypeObj?.icon}</span>
                <div>
                  <DialogTitle>Génération en cours…</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">L'agent crée tous vos livrables. Cela prend 20-40 secondes.</p>
                </div>
              </div>
            </DialogHeader>
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {streamingText || "Démarrage de la génération…"}
                {streamingText && <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              L'agent rédige vos livrables…
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
