import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Share2,
  Mail,
  Printer,
  Instagram,
  Linkedin,
  Facebook,
  MessageCircle,
  Send,
  Music2,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Image as ImageIcon,
  Calendar,
  Target,
} from "lucide-react";
import { ImageGeneratorDialog, ScheduleDialog, LandingPageDialog } from "@/components/campaign-extras";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface CampaignActionsProps {
  content: string;
  title?: string;
}

interface ExtractedPost {
  label: string;
  platform: string;
  caption: string;
}

function extractPosts(raw: string): ExtractedPost[] {
  const posts: ExtractedPost[] = [];
  // Match headers like "### Post 1 — Facebook — Lundi 9h00" or "POST 1 - FACEBOOK - Mardi 8h30"
  const postRegex = /(?:#{1,3}\s*)?Post\s*(\d+)\s*[—–\-]\s*([A-Za-zÀ-ÿ]+)\s*[—–\-]\s*([^\n]*)/gi;
  const matches = [...raw.matchAll(postRegex)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIdx = match.index! + match[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    let caption = raw.slice(startIdx, endIdx)
      .replace(/^---$/gm, "")
      .replace(/🖼️\s*IMAGE\s*:\s*.+/gi, "")
      .replace(/^#{1,3}\s+.+$/gm, "")
      .replace(/^\*\*Post \d+\*\*.*/gmi, "")
      .replace(/^!\[.*\]\(.*\)$/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // Stop at calendar/reels/tips/images sections
    const sectionBreak = caption.search(/^(?:#{1,3}\s*)?📅|^(?:#{1,3}\s*)?🎬|^(?:#{1,3}\s*)?💡|^(?:#{1,3}\s*)?🖼️|^CALENDRIER|^IDÉES DE REELS|^ASTUCES/mi);
    if (sectionBreak > 0) caption = caption.slice(0, sectionBreak).trim();
    if (caption.length > 10) {
      const platform = match[2].trim().toLowerCase();
      posts.push({
        label: `Post ${match[1]} — ${match[2].trim()} — ${match[3].trim()}`,
        platform,
        caption,
      });
    }
  }
  return posts;
}

function cleanContentForShare(raw: string): string {
  return raw
    .replace(/🖼️\s*IMAGE\s*:\s*.+/gi, "")
    .replace(/^---$/gm, "")
    .replace(/^#{1,3}\s+.*$/gm, "")
    .replace(/^POST \d+\s*—\s*.+$/gmi, "")
    .replace(/^Voici une campagne .+$/gmi, "")
    .replace(/^\*\*Post \d+\*\*\s*:?\s*$/gmi, "")
    .replace(/^!\[.*\]\(.*\)$/gm, "")
    .replace(/🎨\s*\*\*Génération des visuels.+$/gmi, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function CampaignActions({ content, title = "Campagne marketing" }: CampaignActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [landingOpen, setLandingOpen] = useState(false);
  const [postPickerOpen, setPostPickerOpen] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);

  const cleanContent = cleanContentForShare(content);
  const posts = extractPosts(content);
  const hasPosts = posts.length > 0;

  const shareOnePost = (caption: string, platform: string) => {
    const text = caption.slice(0, 280);
    const longText = caption.slice(0, 2000);
    const encoded = encodeURIComponent(text);
    const encodedLong = encodeURIComponent(longText);
    const encodedTitle = encodeURIComponent(title);
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encoded}`,
      linkedin: `https://www.linkedin.com/feed/?shareActive=true&text=${encodedLong}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}&quote=${encoded}`,
      whatsapp: `https://wa.me/?text=${encodedLong}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodedLong}`,
      reddit: `https://www.reddit.com/submit?title=${encodedTitle}&text=${encodedLong}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.origin)}&description=${encoded}`,
    };
    const url = urls[platform];
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareClick = (platform: string) => {
    if (hasPosts) {
      setPendingPlatform(platform);
      setPostPickerOpen(true);
    } else {
      shareOnePost(cleanContent, platform);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanContent);
      toast.success("Contenu copié dans le presse-papier");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const handleDownload = (format: "md" | "txt" | "html") => {
    const ext = format;
    const mime =
      format === "html" ? "text/html" : format === "md" ? "text/markdown" : "text/plain";
    let payload = content;
    if (format === "html") {
      payload = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a1a}h1,h2,h3{color:#111;margin-top:1.5em}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px}</style>
</head><body><h1>${title}</h1><pre>${content.replace(/</g, "&lt;")}</pre></body></html>`;
    }
    const blob = new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, "_").slice(0, 60)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Téléchargé en .${ext}`);
  };

  const handlePrint = () => window.print();

  const handleInstagramOrTikTok = (app: "instagram" | "tiktok") => {
    if (hasPosts) {
      setPendingPlatform(app);
      setPostPickerOpen(true);
    } else {
      copyAndOpen(cleanContent, app);
    }
  };

  const copyAndOpen = async (text: string, app: "instagram" | "tiktok") => {
    const url = app === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/upload";
    const label = app === "instagram" ? "Instagram" : "TikTok";
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Contenu copié ! Ouvre ${label} et colle le texte.`, {
        action: { label: "Ouvrir", onClick: () => window.open(url, "_blank") },
        duration: 6000,
      });
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleEmailQuick = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(cleanContent.slice(0, 5000));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      <div className="mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Publier / Exécuter cette campagne</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 text-xs" data-testid="action-copy">
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copier
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="action-download-trigger">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleDownload("md")}>📝 Markdown (.md)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("txt")}>📄 Texte (.txt)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("html")}>🌐 Page HTML (.html)</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>🖨️ Imprimer / PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90" data-testid="action-publish-trigger">
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Publier <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Réseaux sociaux</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleShareClick("linkedin")}>
                <Linkedin className="w-4 h-4 mr-2 text-[#0A66C2]" /> Partager sur LinkedIn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShareClick("facebook")}>
                <Facebook className="w-4 h-4 mr-2 text-[#1877F2]" /> Partager sur Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShareClick("twitter")}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Tweet (X)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInstagramOrTikTok("instagram")}>
                <Instagram className="w-4 h-4 mr-2 text-[#E4405F]" /> Instagram (copier + ouvrir)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInstagramOrTikTok("tiktok")}>
                <Music2 className="w-4 h-4 mr-2 text-foreground" /> TikTok (copier + ouvrir)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShareClick("pinterest")}>
                <svg className="w-4 h-4 mr-2 text-[#E60023]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.756-1.378l-.749 2.853c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>
                Pinterest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShareClick("reddit")}>
                <svg className="w-4 h-4 mr-2 text-[#FF4500]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>
                Reddit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Messageries</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleShareClick("whatsapp")}>
                <MessageCircle className="w-4 h-4 mr-2 text-[#25D366]" /> WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShareClick("telegram")}>
                <Send className="w-4 h-4 mr-2 text-[#26A5E4]" /> Telegram
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEmailQuick}>
                <Mail className="w-4 h-4 mr-2 text-foreground" /> Email (client par défaut)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setEmailOpen(true)}
            className="h-8 text-xs"
            data-testid="action-send-email"
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Envoyer par email
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setImageOpen(true)}
            className="h-8 text-xs"
            data-testid="action-image"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Visuel IA
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setScheduleOpen(true)}
            className="h-8 text-xs"
            data-testid="action-schedule"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" /> Programmer
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setLandingOpen(true)}
            className="h-8 text-xs"
            data-testid="action-landing"
          >
            <Target className="w-3.5 h-3.5 mr-1.5" /> Page de capture
          </Button>

          <Button size="sm" variant="ghost" onClick={handlePrint} className="h-8 text-xs" data-testid="action-print">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimer
          </Button>
        </div>
      </div>

      <EmailSendDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultSubject={title}
        defaultBody={content}
      />
      <ImageGeneratorDialog
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        defaultPrompt={`Visuel pour : ${content.slice(0, 200)}`}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        defaultTitle={title}
        defaultContent={content}
      />
      <LandingPageDialog
        open={landingOpen}
        onClose={() => setLandingOpen(false)}
        defaultTitle={title}
        defaultHeadline={content.split("\n")[0]?.slice(0, 80) || title}
      />

      {/* Post picker dialog */}
      <Dialog open={postPickerOpen} onOpenChange={setPostPickerOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quel post veux-tu publier ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {posts.map((post, i) => {
              const platformIcon = post.platform === "linkedin" ? "🔵" : post.platform === "instagram" ? "📸" : "📘";
              return (
                <button
                  key={i}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/60 transition-colors"
                  onClick={async () => {
                    setPostPickerOpen(false);
                    if (pendingPlatform === "instagram" || pendingPlatform === "tiktok") {
                      await copyAndOpen(post.caption, pendingPlatform);
                    } else if (pendingPlatform) {
                      shareOnePost(post.caption, pendingPlatform);
                    }
                    setPendingPlatform(null);
                  }}
                >
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    {platformIcon} {post.label}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                    {post.caption.slice(0, 200)}{post.caption.length > 200 ? "…" : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Email Send Dialog ──────────────────────────────────────────────────────
interface EmailSendDialogProps {
  open: boolean;
  onClose: () => void;
  defaultSubject: string;
  defaultBody: string;
}

function EmailSendDialog({ open, onClose, defaultSubject, defaultBody }: EmailSendDialogProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Saisissez au moins une adresse email");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/openai/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.split(/[,;\s]+/).filter(Boolean),
          subject,
          body,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.provider === "none") {
          toast.error(data.error || "Aucun fournisseur email configuré", {
            description: "Connectez Sendgrid pour activer l'envoi automatique.",
            duration: 8000,
          });
        } else {
          toast.error(data.error || "Échec de l'envoi");
        }
        return;
      }
      toast.success(`Email envoyé à ${data.recipients} destinataire(s) via ${data.provider}`);
      onClose();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSending(false);
    }
  };

  const handleMailto = () => {
    const params = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 5000))}`;
    window.location.href = `mailto:${encodeURIComponent(to)}?${params}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Envoyer par email
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Envoi automatique via Sendgrid si connecté, sinon utilisez votre client email habituel.
          </p>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label htmlFor="email-to">Destinataires (séparés par , ou ;)</Label>
            <Input
              id="email-to"
              type="text"
              placeholder="contact@exemple.com, journaliste@media.fr"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="input-email-to"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-subject">Objet</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-email-subject"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="text-xs font-mono"
              data-testid="input-email-body"
            />
          </div>
        </div>
        <div className="flex justify-between gap-2 mt-2">
          <Button variant="ghost" onClick={handleMailto} data-testid="button-mailto">
            <ExternalLink className="w-4 h-4 mr-1.5" /> Ouvrir dans mon client
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending || !to.trim()} data-testid="button-send-email">
              {sending ? "Envoi…" : "✉️ Envoyer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
