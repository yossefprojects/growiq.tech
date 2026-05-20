import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Copy, Calendar, ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ════════════════════════════════════════════════════════════════════════════
// IMAGE GENERATOR DIALOG
// ════════════════════════════════════════════════════════════════════════════
interface ImageGeneratorProps {
  open: boolean;
  onClose: () => void;
  defaultPrompt?: string;
}

export function ImageGeneratorDialog({ open, onClose, defaultPrompt = "" }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [size, setSize] = useState<"1024x1024" | "1536x1024" | "1024x1536">("1024x1024");
  const [loading, setLoading] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Décrivez le visuel à générer");
      return;
    }
    setLoading(true);
    setImageDataUrl(null);
    try {
      const response = await fetch("/api/openai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size }),
      });
      if (!response.ok) throw new Error("Génération échouée");
      const data = await response.json();
      if (!data.b64_json) throw new Error("Réponse vide");
      setImageDataUrl(`data:image/png;base64,${data.b64_json}`);
      toast.success("Visuel généré !");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageDataUrl) return;
    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = `visuel-${Date.now()}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" /> Générer un visuel IA
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Créez un visuel parfait pour Instagram, LinkedIn, blog ou affiche en quelques secondes.
          </p>
        </DialogHeader>
        <div className="space-y-3 mt-3">
          <div className="space-y-1">
            <Label htmlFor="img-prompt">Description du visuel</Label>
            <Textarea
              id="img-prompt"
              placeholder="ex: une assiette colorée de pâtes italiennes sur fond de marbre, style photo magazine, lumière naturelle"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              data-testid="img-prompt"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="img-size">Format</Label>
            <select
              id="img-size"
              value={size}
              onChange={(e) => setSize(e.target.value as typeof size)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              data-testid="img-size"
            >
              <option value="1024x1024">⬛ Carré (1024×1024) — Instagram, Facebook</option>
              <option value="1536x1024">▭ Paysage (1536×1024) — bannière, LinkedIn, blog</option>
              <option value="1024x1536">▯ Portrait (1024×1536) — Story, Pinterest, Reels</option>
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full" data-testid="img-generate">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Génération…</> : <><Sparkles className="w-4 h-4 mr-2" /> Générer le visuel</>}
          </Button>
          {imageDataUrl && (
            <div className="space-y-2 mt-2">
              <img src={imageDataUrl} alt="Visuel généré" className="w-full rounded-lg border border-border" />
              <Button onClick={handleDownload} variant="outline" className="w-full" data-testid="img-download">
                <Download className="w-4 h-4 mr-2" /> Télécharger le visuel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCHEDULE DIALOG
// ════════════════════════════════════════════════════════════════════════════
interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultContent?: string;
}

const PLATFORM_OPTIONS = [
  { value: "email", label: "📧 Email (envoi automatique si Sendgrid connecté)" },
  { value: "linkedin", label: "💼 LinkedIn (rappel + 1-clic publier)" },
  { value: "facebook", label: "📘 Facebook (rappel + 1-clic publier)" },
  { value: "twitter", label: "🐦 X / Twitter (rappel + 1-clic publier)" },
  { value: "instagram", label: "📷 Instagram (rappel + copie auto)" },
  { value: "tiktok", label: "🎵 TikTok (rappel + copie auto)" },
  { value: "whatsapp", label: "💬 WhatsApp (rappel + 1-clic envoyer)" },
];

export function ScheduleDialog({ open, onClose, defaultTitle = "", defaultContent = "" }: ScheduleDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState(defaultContent);
  const [platform, setPlatform] = useState("email");
  const [scheduledFor, setScheduledFor] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title || !content || !platform || !scheduledFor) {
      toast.error("Renseignez tous les champs");
      return;
    }
    setSaving(true);
    try {
      const meta: { recipients?: string[]; subject?: string } = {};
      if (platform === "email") {
        const r = recipients.split(/[,;\s]+/).filter(Boolean);
        if (r.length === 0) {
          toast.error("Au moins un destinataire requis pour l'email");
          setSaving(false);
          return;
        }
        meta.recipients = r;
        meta.subject = subject || title;
      }
      const response = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          platform,
          scheduledFor: new Date(scheduledFor).toISOString(),
          meta,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur");
      }
      toast.success("Programmé ! Sera traité automatiquement à l'heure choisie.");
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Programmer la publication
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Publication automatique pour l'email (si fournisseur connecté), rappel à l'heure dite pour les réseaux sociaux.
          </p>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label>Titre interne</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="sched-title" />
          </div>
          <div className="space-y-1">
            <Label>Plateforme</Label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              data-testid="sched-platform"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Date & heure</Label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              data-testid="sched-when"
            />
          </div>
          {platform === "email" && (
            <>
              <div className="space-y-1">
                <Label>Destinataires (séparés par , ou ;)</Label>
                <Input
                  placeholder="lead1@x.com, lead2@y.com"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  data-testid="sched-recipients"
                />
              </div>
              <div className="space-y-1">
                <Label>Objet email (laisser vide pour utiliser le titre)</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="sched-subject" />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Contenu</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              data-testid="sched-content"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="sched-save">
            {saving ? "Programmation…" : "📅 Programmer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LANDING PAGE BUILDER DIALOG
// ════════════════════════════════════════════════════════════════════════════
interface LandingPageDialogProps {
  open: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultHeadline?: string;
}

export function LandingPageDialog({ open, onClose, defaultTitle = "", defaultHeadline = "" }: LandingPageDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState(defaultHeadline);
  const [subheadline, setSubheadline] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Je m'inscris");
  const [successMessage, setSuccessMessage] = useState("Merci ! Nous vous recontactons très vite.");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [includePhone, setIncludePhone] = useState(false);
  const [includeMessage, setIncludeMessage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const publicUrl = createdSlug ? `${window.location.origin}${import.meta.env.BASE_URL}landing/${createdSlug}` : "";

  const handleCreate = async () => {
    if (!title || !headline || !slug) {
      toast.error("Titre, slug et headline requis");
      return;
    }
    setCreating(true);
    try {
      const fields = ["name", "email"];
      if (includePhone) fields.push("phone");
      if (includeMessage) fields.push("message");
      const response = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          headline,
          subheadline,
          ctaLabel,
          successMessage,
          fields,
          style: { primaryColor },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");
      setCreatedSlug(data.slug);
      toast.success("Page de capture créée !");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("URL copiée");
  };

  const handleClose = () => {
    setTitle(defaultTitle);
    setSlug("");
    setHeadline(defaultHeadline);
    setSubheadline("");
    setCreatedSlug(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎯 Créer une page de capture de leads</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Génère une page publique avec un formulaire qui collecte automatiquement les contacts intéressés.
          </p>
        </DialogHeader>

        {createdSlug ? (
          <div className="space-y-3 mt-2">
            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center">
              <p className="font-semibold text-green-700 dark:text-green-400 mb-2">✅ Page publiée !</p>
              <p className="text-xs text-muted-foreground mb-3">Partagez ce lien partout (réseaux, email, bio)</p>
              <code className="block bg-background px-3 py-2 rounded text-xs break-all border">{publicUrl}</code>
              <div className="flex gap-2 mt-3">
                <Button onClick={handleCopy} variant="outline" size="sm" className="flex-1">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copier
                </Button>
                <Button onClick={() => window.open(publicUrl, "_blank")} size="sm" className="flex-1">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Ouvrir
                </Button>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">Terminé</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Titre interne</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Lead magnet e-book" data-testid="lp-title" />
                </div>
                <div className="space-y-1">
                  <Label>Slug (URL)</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: ebook-marketing" data-testid="lp-slug" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Titre principal (gros texte)</Label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="ex: Téléchargez notre guide gratuit" data-testid="lp-headline" />
              </div>
              <div className="space-y-1">
                <Label>Sous-titre</Label>
                <Textarea value={subheadline} onChange={(e) => setSubheadline(e.target.value)} rows={2} placeholder="Une phrase qui donne envie de remplir le formulaire" data-testid="lp-subheadline" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Bouton CTA</Label>
                  <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} data-testid="lp-cta" />
                </div>
                <div className="space-y-1">
                  <Label>Couleur principale</Label>
                  <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9" data-testid="lp-color" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Message de confirmation</Label>
                <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} data-testid="lp-success" />
              </div>
              <div className="space-y-1">
                <Label>Champs additionnels</Label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includePhone} onChange={(e) => setIncludePhone(e.target.checked)} />
                    Téléphone
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeMessage} onChange={(e) => setIncludeMessage(e.target.checked)} />
                    Message libre
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating || !title || !slug || !headline} data-testid="lp-create">
                {creating ? "Création…" : "🚀 Créer & Publier"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
