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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

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
type GoogleAdsStatus = {
  platform: "google_ads";
  configured: boolean;
  connected: boolean;
  comingSoon: boolean;
};

type IntegrationsResponse = {
  facebook: FacebookStatus;
  instagram: InstagramStatus;
  linkedin: LinkedinStatus;
  resend: ResendStatus;
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        <AlertTriangle className="w-3.5 h-3.5" />
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
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
  const connected = fb.connected;
  const badge = !fb.configured ? (
    <Badge variant="off">Pas encore disponible</Badge>
  ) : connected ? (
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
      {!fb.configured ? (
        <p className="text-sm text-muted-foreground">
          La connexion Facebook arrive très bientôt. On attend la validation Meta
          côté admin GrowIQ.
        </p>
      ) : connected ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-[#3dbf8e]/10 border border-[#3dbf8e]/30 p-3 text-sm text-[#1a7a55]">
            Ton compte est connecté. Tu peux publier des posts depuis l'agence
            automatique ou le chat.
            {!ig.connected ? (
              <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
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
              className="text-red-600 hover:text-red-700"
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
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              Ton accès Facebook a expiré (ça arrive tous les ~60 jours). Reconnecte-toi
              pour continuer à publier.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connecte ton compte Facebook pour publier sur ta page et ton compte
              Instagram Business associé.
            </p>
          )}
          {fb.lastErrorMessage ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              Dernière erreur : {fb.lastErrorMessage}
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
        </div>
      )}
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
  const badge = !ln.configured ? (
    <Badge variant="off">Pas encore disponible</Badge>
  ) : ln.connected ? (
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
      {!ln.configured ? (
        <p className="text-sm text-muted-foreground">
          LinkedIn n'est pas configuré côté serveur.
        </p>
      ) : ln.connected ? (
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
            className="text-red-600 hover:text-red-700"
            data-testid="button-linkedin-disconnect"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Déconnecter
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ln.expired ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
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
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
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
              className="text-red-600 hover:text-red-700"
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

function GoogleAdsSection({ status }: { status: GoogleAdsStatus }) {
  return (
    <Card
      icon={() => (
        <span className="font-bold text-[#4285F4] text-base">G</span>
      )}
      iconBg="bg-[#4285F4]/10"
      iconColor="text-[#4285F4]"
      title="Google Ads"
      subtitle="Lance des campagnes Search (résultats Google)"
      badge={<Badge variant="off">Bientôt disponible</Badge>}
    >
      <p className="text-sm text-muted-foreground">
        En attente de la validation du developer token Google côté admin GrowIQ.
        Dès que c'est prêt, tu pourras connecter ton compte Google Ads ici.
      </p>
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

  // Toasts depuis le callback OAuth FB (query string facebook=...)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const fb = params.get("facebook");
    if (fb === "ok") {
      toastSuccess("Facebook connecté !");
    } else if (fb) {
      toastError(fb);
    }
    const ln = params.get("linkedin");
    if (ln === "ok") {
      toastSuccess("LinkedIn connecté !");
    } else if (ln) {
      toastError(ln);
    }
    if (fb || ln) {
      // Clean URL
      window.history.replaceState({}, "", basePath + "/app/integrations");
    }
  }, [search]);

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
    platform: "facebook" | "linkedin",
    setLoading: (b: boolean) => void,
  ) => {
    setLoading(true);
    try {
      const r = await authedFetch(`${basePath}/api/auth/${platform}/start`);
      if (!r.ok) {
        const txt = await r.text();
        toastError(
          platform === "facebook"
            ? `Impossible de démarrer la connexion Facebook : ${txt}`
            : `Impossible de démarrer la connexion LinkedIn : ${txt}`,
        );
        setLoading(false);
        return;
      }
      const { url } = (await r.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Erreur réseau");
      setLoading(false);
    }
  };

  const disconnect = useMutation({
    mutationFn: async (platform: "meta" | "linkedin" | "resend") => {
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

  const data = integrationsQ.data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
          data-testid="link-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>

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
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
            <GoogleAdsSection status={data.googleAds} />
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
