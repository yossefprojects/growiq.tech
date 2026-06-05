/**
 * Page "Mes outils" (anciennement "Publicités payantes") — vue unifiée
 * multi-plateforme. Chaque utilisateur connecte SES propres comptes ici.
 *
 * Plateformes :
 *  - Facebook + Instagram (un seul OAuth Meta)
 *  - LinkedIn (OAuth séparé)
 *  - Resend (clé API + domaine, avec test connexion + freemium 100 emails/mois)
 *  - Google Ads (bientôt — en attente du developer token Basic Access côté admin)
 *
 * Tradeoff signalé : on stocke les tokens en clair en base (cohérent avec
 * l'existant LinkedIn). À chiffrer dans une migration ultérieure.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@clerk/react";
import { Link, useSearch } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Mail,
  Facebook,
  Instagram,
  Linkedin,
  Clock,
  TestTube2,
  Trash2,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

// Adresse de contact de l'équipe GrowIQ (modifiable ici en un seul endroit).
const GROWIQ_SUPPORT_EMAIL = "support@growiq.tech";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types depuis /api/integrations ──────────────────────────────────────

type FacebookStatus = {
  platform: "facebook";
  configured: boolean;
  connected: boolean;
  expired: boolean;
  label: string | null;
  displayName: string | null;
  expiresAt: string | null;
  lastErrorMessage: string | null;
};
type InstagramStatus = {
  platform: "instagram";
  configured: boolean;
  connected: boolean;
  expired: boolean;
  username: string | null;
  expiresAt: string | null;
};
type LinkedinStatus = {
  platform: "linkedin";
  configured: boolean;
  connected: boolean;
  expired: boolean;
  label: string | null;
  email: string | null;
  pictureUrl: string | null;
  expiresAt: string | null;
};
type ResendStatus = {
  platform: "resend";
  configured: boolean;
  connected: boolean;
  fromEmail: string | null;
  fromName: string | null;
  verifiedAt: string | null;
  lastErrorMessage: string | null;
};
type MetaAdsStatus = {
  platform: "meta_ads";
  configured: boolean;
  connected: boolean;
  expired: boolean;
  adAccountId: string | null;
  adAccountName: string | null;
  currency: string | null;
  adAccountsCount: number;
};
type GoogleAdsStatus = {
  platform: "google_ads";
  configured: boolean;
  connected: boolean;
  expired: boolean;
  email: string | null;
  customerId: string | null;
  apiReady: boolean;
};

type IntegrationsResponse = {
  facebook: FacebookStatus;
  instagram: InstagramStatus;
  linkedin: LinkedinStatus;
  resend: ResendStatus;
  metaAds: MetaAdsStatus;
  googleAds: GoogleAdsStatus;
};

type EmailUsageResponse =
  | { usingOwnKey: true; quota: null; used: null; remaining: null }
  | {
      usingOwnKey: false;
      used: number;
      quota: number;
      remaining: number;
      year: number;
      month: number;
    };

// ── Badge statut ─────────────────────────────────────────────────────────

function Badge({
  variant,
  children,
}: {
  variant: "ok" | "warn" | "off";
  children: React.ReactNode;
}) {
  if (variant === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#3dbf8e]/15 text-[#1a7a55]">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {children}
      </span>
    );
  }
  if (variant === "warn") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/100/15 text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5" />
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
      <XCircle className="w-3.5 h-3.5" />
      {children}
    </span>
  );
}

// ── Card générique ───────────────────────────────────────────────────────

function Card({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string | null;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`shrink-0 rounded-xl ${iconBg} p-2.5`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground truncate">{title}</h3>
            {subtitle ? (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      {children}
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────

// Traduit les erreurs techniques de Meta en messages simples et rassurants —
// aucun code brut (#200, pages_manage_posts, etc.) ne doit atteindre l'écran.
function friendlyMetaError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (
    /app review|pages_manage_posts|instagram_content_publish|#200|not been approved|autoris|permission/.test(
      r,
    )
  ) {
    return "Tu n'as pas encore accès à cette fonctionnalité — contacte GrowIQ.";
  }
  if (/expire|session has expired|#190|#102|#463|token/.test(r)) {
    return "Ta connexion a expiré. Reconnecte-toi pour continuer.";
  }
  if (/no_pages|aucune page|page/.test(r)) {
    return "On n'a pas trouvé de page Facebook professionnelle sur ton compte.";
  }
  return "La connexion n'a pas pu aboutir. Réessaie, ou contacte GrowIQ si ça persiste.";
}

// Mappe un statut/erreur OAuth Facebook (query string, postMessage ou texte
// serveur) vers un message FR clair — jamais de code technique brut à l'écran.
function friendlyFacebookStatus(raw: string): string {
  const r = raw.toLowerCase();
  if (/cancel|annul|access_denied|denied/.test(r)) {
    return "Connexion annulée. Tu peux réessayer quand tu veux.";
  }
  return (
    friendlyMetaError(raw) ??
    "La connexion Facebook n'a pas abouti. Réessaie, ou contacte GrowIQ."
  );
}

type StepState = "done" | "current" | "todo";

function StepRow({
  n,
  state,
  title,
  desc,
}: {
  n: number;
  state: StepState;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        {state === "done" ? (
          <CheckCircle2 className="w-5 h-5 text-[#1a7a55]" />
        ) : state === "current" ? (
          <div className="w-5 h-5 rounded-full bg-[#1877F2] text-white text-[11px] font-bold flex items-center justify-center">
            {n}
          </div>
        ) : (
          <Circle className="w-5 h-5 text-gray-300" />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}
        >
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

// Assistant guidé en 3 étapes — l'état de chaque étape reflète la connexion réelle.
function MetaStepper({ fb, ig }: { fb: FacebookStatus; ig: InstagramStatus }) {
  const step1: StepState = fb.connected ? "done" : "current";
  const pageOk = fb.connected && !!fb.label;
  const step2: StepState = pageOk ? "done" : fb.connected ? "current" : "todo";
  const step3: StepState = ig.connected ? "done" : fb.connected ? "current" : "todo";

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3" data-testid="meta-stepper">
      <StepRow
        n={1}
        state={step1}
        title="Connecte Facebook"
        desc="Autorise GrowIQ à publier sur ta page."
      />
      <StepRow
        n={2}
        state={step2}
        title="Vérifie ta page"
        desc={pageOk ? `Page détectée : ${fb.label}` : "On récupère ta page Facebook professionnelle."}
      />
      <StepRow
        n={3}
        state={step3}
        title="Instagram détecté"
        desc={
          ig.connected && ig.username
            ? `Compte lié : ${ig.username}`
            : "Le compte Instagram Business lié à ta page."
        }
      />
    </div>
  );
}

// Checklist visuelle des prérequis, montrée avant la 1ère connexion.
function MetaChecklist() {
  const items = [
    "Une page Facebook professionnelle",
    "Un compte Instagram Business (ou Créateur)",
    "Ton Instagram lié à ta page Facebook",
  ];
  return (
    <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4" data-testid="meta-checklist">
      <p className="text-sm font-semibold text-blue-200 mb-2">
        Avant de commencer, assure-toi d'avoir :
      </p>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-2 text-sm text-blue-200">
            <CheckCircle2 className="w-4 h-4 text-[#1a7a55] shrink-0" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Boîte de dialogue "Besoin d'aide ?" — chat in-app ou email à l'équipe GrowIQ.
function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mailHref = `mailto:${GROWIQ_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "Besoin d'aide — connexion Facebook / Instagram",
  )}&body=${encodeURIComponent(
    "Bonjour l'équipe GrowIQ,\n\nJ'ai besoin d'aide pour connecter mon compte Facebook / Instagram.\n\nVoici ma situation :\n\n",
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Besoin d'aide ?</DialogTitle>
          <DialogDescription>
            On est là pour t'aider à connecter Facebook et Instagram. Choisis
            comment nous joindre.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              window.location.href = mailHref;
            }}
            data-testid="button-help-email"
          >
            <Mail className="w-4 h-4 mr-2" />
            Écrire à l'équipe GrowIQ
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              onOpenChange(false);
              window.location.href = `${basePath}/app`;
            }}
            data-testid="button-help-chat"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Discuter avec l'assistant GrowIQ
          </Button>
          <p className="text-xs text-muted-foreground">
            Tu peux aussi nous écrire directement à {GROWIQ_SUPPORT_EMAIL}.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FacebookSection({
  fb,
  ig,
  onConnect,
  onDisconnect,
  connecting,
}: {
  fb: FacebookStatus;
  ig: InstagramStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const connected = fb.connected;
  const friendlyError = friendlyMetaError(fb.lastErrorMessage);
  const badge = connected ? (
    <Badge variant="ok">Connecté</Badge>
  ) : fb.expired ? (
    <Badge variant="warn">À reconnecter</Badge>
  ) : (
    <Badge variant="off">Non connecté</Badge>
  );

  return (
    <Card
      icon={Facebook}
      iconBg="bg-[#1877F2]/10"
      iconColor="text-[#1877F2]"
      title="Facebook & Instagram"
      subtitle={
        connected
          ? `${fb.label ?? "Ma page"}${ig.connected && ig.username ? ` • Instagram ${ig.username}` : ""}`
          : "Publie sur ta page Facebook et ton compte Instagram Business"
      }
      badge={badge}
    >
      <div className="space-y-4">
        <MetaStepper fb={fb} ig={ig} />

        {connected ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-[#3dbf8e]/10 border border-[#3dbf8e]/30 p-3 text-sm text-[#1a7a55]">
              Ton compte est connecté. Tu peux publier des posts depuis l'agence
              automatique ou le chat.
              {!ig.connected ? (
                <div className="mt-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                  Astuce : pour publier sur Instagram, lie un compte Instagram Business
                  à ta page Facebook depuis l'app Instagram (Paramètres → Compte
                  connecté), puis reconnecte ici.
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onConnect}
                disabled={connecting}
                data-testid="button-facebook-reconnect"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Reconnecter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisconnect}
                className="text-red-600 hover:text-red-300"
                data-testid="button-facebook-disconnect"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Déconnecter
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {fb.expired ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
                Ton accès Facebook a expiré (ça arrive tous les ~60 jours). Reconnecte-toi
                pour continuer à publier.
              </div>
            ) : (
              <>
                <MetaChecklist />
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-200">
                  <span className="font-semibold">Accès anticipé.</span> La
                  connexion Facebook est en cours de validation par Meta. En
                  attendant, elle fonctionne pour les comptes invités par
                  l'équipe GrowIQ. Contacte-nous si tu veux y accéder.
                </div>
              </>
            )}
            {friendlyError ? (
              <p
                className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2"
                data-testid="text-facebook-error"
              >
                {friendlyError}
              </p>
            ) : null}
            <Button
              onClick={onConnect}
              disabled={connecting}
              className="bg-[#1877F2] hover:bg-[#1465D6] text-white"
              data-testid="button-facebook-connect"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Facebook className="w-4 h-4 mr-2" />
              )}
              Connecter Facebook
            </Button>
            <Link
              href="/app/integrations/facebook"
              className="block text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
              data-testid="link-facebook-manual"
            >
              Ou connecter manuellement avec un token
            </Link>
          </div>
        )}

        <div className="pt-1 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setHelpOpen(true)}
            data-testid="button-facebook-help"
          >
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Besoin d'aide ?
          </Button>
        </div>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </Card>
  );
}

function LinkedinSection({
  ln,
  onConnect,
  onDisconnect,
  connecting,
}: {
  ln: LinkedinStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
}) {
  const badge = ln.connected ? (
    <Badge variant="ok">Connecté</Badge>
  ) : ln.expired ? (
    <Badge variant="warn">À reconnecter</Badge>
  ) : (
    <Badge variant="off">Non connecté</Badge>
  );

  return (
    <Card
      icon={Linkedin}
      iconBg="bg-[#0A66C2]/10"
      iconColor="text-[#0A66C2]"
      title="LinkedIn"
      subtitle={
        ln.connected
          ? `${ln.label ?? "Mon compte"}${ln.email ? ` • ${ln.email}` : ""}`
          : "Publie sur ton profil LinkedIn"
      }
      badge={badge}
    >
      {ln.connected ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onConnect}
            disabled={connecting}
            data-testid="button-linkedin-reconnect"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            Reconnecter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="text-red-600 hover:text-red-300"
            data-testid="button-linkedin-disconnect"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Déconnecter
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ln.expired ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
              Ton accès LinkedIn a expiré. Reconnecte-toi en 1 clic.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connecte ton compte LinkedIn pour publier sur ton profil.
            </p>
          )}
          <Button
            onClick={onConnect}
            disabled={connecting}
            className="bg-[#0A66C2] hover:bg-[#0958A8] text-white"
            data-testid="button-linkedin-connect"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Linkedin className="w-4 h-4 mr-2" />
            )}
            Connecter LinkedIn
          </Button>
          <Link
            href="/app/integrations/linkedin"
            className="block text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
            data-testid="link-linkedin-manual"
          >
            Ou connecter manuellement avec un token
          </Link>
        </div>
      )}
    </Card>
  );
}

function ResendSection({
  resend,
  usage,
  onSave,
  onTest,
  onDisconnect,
  saving,
  testing,
}: {
  resend: ResendStatus;
  usage: EmailUsageResponse | undefined;
  onSave: (apiKey: string, fromEmail: string, fromName: string) => void;
  onTest: () => void;
  onDisconnect: () => void;
  saving: boolean;
  testing: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (resend.connected && resend.fromEmail) {
      setFromEmail(resend.fromEmail);
      setFromName(resend.fromName ?? "");
    }
  }, [resend.connected, resend.fromEmail, resend.fromName]);

  const badge = resend.connected ? (
    resend.verifiedAt ? (
      <Badge variant="ok">Connecté et testé</Badge>
    ) : (
      <Badge variant="warn">À tester</Badge>
    )
  ) : (
    <Badge variant="off">Freemium 100/mois</Badge>
  );

  const usageInfo =
    usage && !usage.usingOwnKey ? (
      <div className="text-xs text-muted-foreground">
        Tu utilises la clé partagée GrowIQ :{" "}
        <strong className="text-foreground">
          {usage.used}/{usage.quota} emails ce mois
        </strong>
        {usage.remaining > 0
          ? ` — il te reste ${usage.remaining}.`
          : " — quota atteint, connecte ta propre clé."}
      </div>
    ) : usage?.usingOwnKey ? (
      <div className="text-xs text-muted-foreground">
        Tu utilises ta propre clé Resend (envois illimités, c'est ton compte
        Resend qui paie).
      </div>
    ) : null;

  return (
    <Card
      icon={Mail}
      iconBg="bg-[#5b54d6]/10"
      iconColor="text-[#5b54d6]"
      title="Emailing (Resend)"
      subtitle={
        resend.connected && resend.fromEmail
          ? `Envoi depuis ${resend.fromEmail}`
          : "Envoie des newsletters et des séquences d'emails"
      }
      badge={badge}
    >
      <div className="space-y-3">
        {usageInfo}

        {resend.lastErrorMessage ? (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
            <strong>Échec du dernier test :</strong> {resend.lastErrorMessage}
          </div>
        ) : null}

        {resend.connected && !showForm ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={testing}
              data-testid="button-resend-test"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <TestTube2 className="w-4 h-4 mr-1.5" />
              )}
              Tester la connexion
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              data-testid="button-resend-edit"
            >
              Modifier la clé
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="text-red-600 hover:text-red-300"
              data-testid="button-resend-disconnect"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Déconnecter
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {!resend.connected ? (
              <p className="text-sm text-muted-foreground">
                Pour envoyer depuis ton propre domaine (et sans quota), ajoute ta
                clé Resend.{" "}
                <a
                  href="https://resend.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5b54d6] hover:underline inline-flex items-center gap-1"
                >
                  Obtenir une clé
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            ) : null}
            <div className="grid gap-3">
              <div>
                <Label htmlFor="resend-key" className="text-xs">
                  Clé API Resend (commence par <code>re_</code>)
                </Label>
                <Input
                  id="resend-key"
                  type="password"
                  placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  data-testid="input-resend-api-key"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="resend-from" className="text-xs">
                    Adresse d'envoi
                  </Label>
                  <Input
                    id="resend-from"
                    type="email"
                    placeholder="contact@monentreprise.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    data-testid="input-resend-from-email"
                  />
                </div>
                <div>
                  <Label htmlFor="resend-name" className="text-xs">
                    Nom d'expéditeur (facultatif)
                  </Label>
                  <Input
                    id="resend-name"
                    type="text"
                    placeholder="Marie chez Boulangerie Dupont"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    data-testid="input-resend-from-name"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Important : ton domaine doit d'abord être vérifié dans Resend
                (SPF/DKIM). Sans ça, tes emails partiront en spam.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onSave(apiKey, fromEmail, fromName)}
                disabled={saving || !apiKey || !fromEmail}
                data-testid="button-resend-save"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Enregistrer
              </Button>
              {resend.connected ? (
                <Button
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  data-testid="button-resend-cancel"
                >
                  Annuler
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function MetaAdsSection({
  status,
  fb,
  onConnect,
  onDisconnect,
  connecting,
}: {
  status: MetaAdsStatus;
  fb: FacebookStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
}) {
  const connected = status.connected;
  const badge = connected ? (
    <Badge variant="ok">Connecté</Badge>
  ) : status.expired ? (
    <Badge variant="warn">À reconnecter</Badge>
  ) : (
    <Badge variant="off">Non connecté</Badge>
  );

  return (
    <Card
      icon={Facebook}
      iconBg="bg-[#1877F2]/10"
      iconColor="text-[#1877F2]"
      title="Meta Ads (Facebook & Instagram)"
      subtitle={
        connected
          ? `${status.adAccountName ?? "Compte pub"}${status.currency ? ` • ${status.currency}` : ""}`
          : "Boost tes posts pour qu'ils touchent plus de monde (payant)"
      }
      badge={badge}
    >
      {connected ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-[#3dbf8e]/10 border border-[#3dbf8e]/30 p-3 text-sm text-[#1a7a55]">
            Ton compte publicitaire Meta est prêt. Tu peux maintenant booster
            des posts Facebook ou Instagram depuis l'agence automatique.
            {status.adAccountsCount > 1 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {status.adAccountsCount} comptes pub détectés — on utilise le
                premier actif par défaut.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="text-red-600 hover:text-red-300"
              data-testid="button-meta-ads-disconnect"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Déconnecter le compte pub
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {fb.connected && status.adAccountsCount === 0 ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
              Tu es connecté à Facebook, mais on n'a pas trouvé de compte
              publicitaire. Crée d'abord un compte pub dans Meta Business Suite,
              puis reconnecte ici pour activer le scope publicitaire.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Booste tes meilleurs posts pour qu'ils touchent plus de monde sur
              Facebook et Instagram. {fb.connected ? "Reconnecte ton compte" : "Connecte ton compte"} pour autoriser
              l'accès publicitaire.
            </p>
          )}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-200">
            <span className="font-semibold">Accès anticipé.</span> L'accès
            publicitaire Meta est en cours de validation par Meta (App Review).
            En attendant, il fonctionne pour les comptes invités par l'équipe
            GrowIQ.
          </div>
          <Button
            onClick={onConnect}
            disabled={connecting}
            className="bg-[#1877F2] hover:bg-[#1465D6] text-white"
            data-testid="button-meta-ads-connect"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Facebook className="w-4 h-4 mr-2" />
            )}
            {fb.connected ? "Autoriser l'accès publicitaire" : "Connecter Meta Ads"}
          </Button>
          <Link
            href="/app/integrations/meta-ads"
            className="block text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
            data-testid="link-meta-ads-manual"
          >
            Ou renseigner manuellement ton Ad Account ID
          </Link>
        </div>
      )}
    </Card>
  );
}

function GoogleAdsSection({
  status,
  onConnect,
  onDisconnect,
  connecting,
}: {
  status: GoogleAdsStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
}) {
  const connected = status.connected;
  const badge = connected ? (
    <Badge variant="ok">Connecté</Badge>
  ) : status.expired ? (
    <Badge variant="warn">À reconnecter</Badge>
  ) : (
    <Badge variant="off">Non connecté</Badge>
  );

  return (
    <Card
      icon={() => <span className="font-bold text-[#4285F4] text-base">G</span>}
      iconBg="bg-[#4285F4]/10"
      iconColor="text-[#4285F4]"
      title="Google Ads"
      subtitle={
        connected
          ? status.email ?? "Compte Google connecté"
          : "Lance des campagnes Search (résultats Google)"
      }
      badge={badge}
    >
      {connected ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-[#3dbf8e]/10 border border-[#3dbf8e]/30 p-3 text-sm text-[#1a7a55]">
            Ton compte Google est connecté.
            {!status.apiReady ? (
              <div className="mt-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                On attend encore la validation Google pour créer de vraies
                campagnes (Developer Token Basic Access). Ta connexion est
                prête, on l'activera dès l'autorisation.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onConnect}
              disabled={connecting}
              data-testid="button-google-ads-reconnect"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Reconnecter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="text-red-600 hover:text-red-300"
              data-testid="button-google-ads-disconnect"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Déconnecter
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connecte ton compte Google pour pouvoir lancer des campagnes Google
            Ads (recherche Google) depuis l'agence automatique.
          </p>
          {!status.apiReady ? (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-200">
              <span className="font-semibold">Connexion possible dès maintenant.</span>{" "}
              Les vraies campagnes seront activées dès que Google valide notre
              accès API (en cours, 2-6 semaines).
            </div>
          ) : null}
          <Button
            onClick={onConnect}
            disabled={connecting || !status.configured}
            className="bg-[#4285F4] hover:bg-[#3367D6] text-white"
            data-testid="button-google-ads-connect"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <span className="font-bold mr-2">G</span>
            )}
            Connecter Google Ads
          </Button>
          <Link
            href="/app/integrations/google-ads"
            className="block text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
            data-testid="link-google-ads-manual"
          >
            Ou renseigner manuellement ton Customer ID
          </Link>
          {!status.configured ? (
            <p className="text-xs text-muted-foreground">
              OAuth Google pas encore configuré côté GrowIQ. On te prévient dès
              que c'est ouvert.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const search = useSearch();
  const [connectingFb, setConnectingFb] = useState(false);
  const [connectingLn, setConnectingLn] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Résultats des callbacks OAuth (query string facebook=... / linkedin=... / google=...)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const fb = params.get("facebook");
    const ln = params.get("linkedin");
    const gg = params.get("google");
    if (!fb && !ln && !gg) return;

    const platform = fb ? "facebook" : ln ? "linkedin" : "google";
    const status = (fb || ln || gg) as string;

    // Si cette page s'est ouverte DANS la petite fenêtre de connexion, on
    // prévient la fenêtre principale GrowIQ et on se ferme automatiquement.
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(
          { source: "growiq-oauth", platform, status },
          window.location.origin,
        );
      } catch {
        /* origines différentes : on ignore, le toast de secours s'affichera */
      }
      window.close();
      return;
    }

    // Cas normal (pas de fenêtre / fenêtre bloquée) : on affiche le toast ici.
    if (fb === "ok") toastSuccess("Facebook connecté !");
    else if (fb) toastError(friendlyFacebookStatus(fb));
    if (ln === "ok") toastSuccess("LinkedIn connecté !");
    else if (ln) toastError(ln);
    if (gg === "ok") toastSuccess("Google Ads connecté !");
    else if (gg) toastError(gg);
    window.history.replaceState({}, "", basePath + "/app/integrations");
  }, [search]);

  // Écoute les résultats envoyés par la petite fenêtre de connexion (popup).
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as
        | { source?: string; platform?: string; status?: string }
        | undefined;
      if (!d || d.source !== "growiq-oauth") return;
      setConnectingFb(false);
      setConnectingLn(false);
      setConnectingGoogle(false);
      const labels: Record<string, string> = {
        facebook: "Facebook",
        linkedin: "LinkedIn",
        google: "Google Ads",
      };
      const label = labels[d.platform ?? ""] ?? "Compte";
      if (d.status === "ok") {
        toastSuccess(`${label} connecté !`);
      } else if (d.status) {
        toastError(
          d.platform === "facebook"
            ? friendlyFacebookStatus(d.status)
            : d.status,
        );
      }
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [qc]);

  const authedFetch = async (url: string, init?: RequestInit) => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const integrationsQ = useQuery<IntegrationsResponse>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const r = await authedFetch(`${basePath}/api/integrations`);
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as IntegrationsResponse;
    },
    staleTime: 15_000,
  });

  const usageQ = useQuery<EmailUsageResponse>({
    queryKey: ["integrations", "email-usage"],
    queryFn: async () => {
      const r = await authedFetch(`${basePath}/api/integrations/email-usage`);
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as EmailUsageResponse;
    },
    staleTime: 15_000,
  });

  const startOAuth = async (
    platform: "facebook" | "linkedin" | "google",
    setLoading: (b: boolean) => void,
  ) => {
    setLoading(true);
    // On ouvre la fenêtre TOUT DE SUITE (de façon synchrone dans le clic) pour
    // ne pas se faire bloquer par le navigateur. La connexion se fait dans cette
    // petite fenêtre : l'utilisateur ne quitte jamais GrowIQ. Une fois terminée,
    // la fenêtre se ferme seule et prévient la page principale (voir useEffect).
    const popup = window.open(
      "about:blank",
      "growiq_oauth",
      "width=600,height=720,menubar=no,toolbar=no,location=no,status=no",
    );
    try {
      const r = await authedFetch(`${basePath}/api/auth/${platform}/start`);
      if (!r.ok) {
        const txt = await r.text();
        const labels: Record<typeof platform, string> = {
          facebook: "Facebook",
          linkedin: "LinkedIn",
          google: "Google",
        };
        toastError(
          platform === "facebook"
            ? friendlyFacebookStatus(txt)
            : `Impossible de démarrer la connexion ${labels[platform]} : ${txt}`,
        );
        popup?.close();
        setLoading(false);
        return;
      }
      const body = (await r.json().catch(() => ({}))) as { url?: string };
      if (!body.url || typeof body.url !== "string") {
        toastError("Le serveur n'a pas renvoyé d'URL de connexion. Réessaie ou utilise la connexion manuelle.");
        popup?.close();
        setLoading(false);
        return;
      }
      if (!popup) {
        // Fenêtre bloquée d'emblée par le navigateur → on bascule sur l'onglet courant.
        window.location.href = body.url;
      } else if (popup.closed) {
        // L'utilisateur a fermé la fenêtre avant la fin : on ne force rien.
        setLoading(false);
      } else {
        popup.location.href = body.url;
        // Si l'utilisateur ferme la fenêtre sans finir, on relâche le spinner.
        const timer = window.setInterval(() => {
          if (popup.closed) {
            window.clearInterval(timer);
            setLoading(false);
          }
        }, 700);
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Erreur réseau");
      popup?.close();
      setLoading(false);
    }
  };

  const disconnect = useMutation({
    mutationFn: async (platform: "meta" | "linkedin" | "resend" | "google_ads") => {
      const r = await authedFetch(`${basePath}/api/integrations/${platform}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      toastSuccess("Compte déconnecté.");
    },
    onError: () => toastError("Impossible de déconnecter ce compte."),
  });

  const saveResend = useMutation({
    mutationFn: async (vars: { apiKey: string; fromEmail: string; fromName: string }) => {
      const r = await authedFetch(`${basePath}/api/integrations/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: vars.apiKey,
          fromEmail: vars.fromEmail,
          fromName: vars.fromName || null,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Échec de l'enregistrement");
      }
    },
    onSuccess: () => {
      toastSuccess("Clé Resend enregistrée. Pense à tester la connexion !");
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["integrations", "email-usage"] });
    },
    onError: (e: Error) => toastError(e.message),
  });

  const testResend = useMutation({
    mutationFn: async () => {
      const r = await authedFetch(`${basePath}/api/integrations/resend/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        sentTo?: string;
        error?: string;
      };
      if (!r.ok || !body.ok) throw new Error(body.error ?? "Test échoué");
      return body;
    },
    onSuccess: (body) => {
      toastSuccess(
        body.sentTo
          ? `Email de test envoyé à ${body.sentTo}. Va vérifier ta boîte (+ spam si besoin).`
          : "Email de test envoyé.",
      );
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: Error) => toastError(e.message),
  });

  // Guard runtime : si jamais l'API renvoie une réponse partielle (champ
  // manquant pour une plateforme), on reconstruit un objet complet avec des
  // valeurs par défaut "non connecté". Évite tout crash en lecture .connected.
  const data: IntegrationsResponse | undefined = integrationsQ.data
    ? {
        facebook: integrationsQ.data.facebook ?? {
          platform: "facebook",
          configured: false,
          connected: false,
          expired: false,
          label: null,
          displayName: null,
          expiresAt: null,
          lastErrorMessage: null,
        },
        instagram: integrationsQ.data.instagram ?? {
          platform: "instagram",
          configured: false,
          connected: false,
          expired: false,
          username: null,
          expiresAt: null,
        },
        linkedin: integrationsQ.data.linkedin ?? {
          platform: "linkedin",
          configured: false,
          connected: false,
          expired: false,
          label: null,
          email: null,
          pictureUrl: null,
          expiresAt: null,
        },
        resend: integrationsQ.data.resend ?? {
          platform: "resend",
          configured: true,
          connected: false,
          fromEmail: null,
          fromName: null,
          verifiedAt: null,
          lastErrorMessage: null,
        },
        metaAds: integrationsQ.data.metaAds ?? {
          platform: "meta_ads",
          configured: false,
          connected: false,
          expired: false,
          adAccountId: null,
          adAccountName: null,
          currency: null,
          adAccountsCount: 0,
        },
        googleAds: integrationsQ.data.googleAds ?? {
          platform: "google_ads",
          configured: false,
          connected: false,
          expired: false,
          email: null,
          customerId: null,
          apiReady: false,
        },
      }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            Mes outils
          </h1>
          <button
            onClick={() => integrationsQ.refetch()}
            disabled={integrationsQ.isFetching}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            data-testid="button-refresh-integrations"
          >
            <RefreshCw
              className={`w-4 h-4 ${integrationsQ.isFetching ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>
        </div>
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          Connecte tes propres comptes pour que l'agent publie et envoie en ton
          nom. Tu peux te déconnecter à tout moment.
        </p>

        {integrationsQ.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#5b54d6]" />
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Impossible de charger tes intégrations. Recharge la page.
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <FacebookSection
              fb={data.facebook}
              ig={data.instagram}
              onConnect={() => startOAuth("facebook", setConnectingFb)}
              onDisconnect={() => disconnect.mutate("meta")}
              connecting={connectingFb}
            />
            <LinkedinSection
              ln={data.linkedin}
              onConnect={() => startOAuth("linkedin", setConnectingLn)}
              onDisconnect={() => disconnect.mutate("linkedin")}
              connecting={connectingLn}
            />
            <ResendSection
              resend={data.resend}
              usage={usageQ.data}
              onSave={(apiKey, fromEmail, fromName) =>
                saveResend.mutate({ apiKey, fromEmail, fromName })
              }
              onTest={() => testResend.mutate()}
              onDisconnect={() => disconnect.mutate("resend")}
              saving={saveResend.isPending}
              testing={testResend.isPending}
            />
            <MetaAdsSection
              status={data.metaAds}
              fb={data.facebook}
              onConnect={() => startOAuth("facebook", setConnectingFb)}
              onDisconnect={() => disconnect.mutate("meta")}
              connecting={connectingFb}
            />
            <GoogleAdsSection
              status={data.googleAds}
              onConnect={() => startOAuth("google", setConnectingGoogle)}
              onDisconnect={() => disconnect.mutate("google_ads")}
              connecting={connectingGoogle}
            />
          </div>
        )}

        <div className="mt-10 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="flex gap-2">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Les jetons Facebook expirent tous les ~60 jours. On te préviendra
              avant l'expiration pour que tu puisses te reconnecter en 1 clic.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
