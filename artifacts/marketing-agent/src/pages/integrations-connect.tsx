/**
 * Pages dédiées de connexion manuelle (token/ID) — alternative à l'OAuth.
 *
 *   /app/integrations/facebook
 *   /app/integrations/linkedin
 *   /app/integrations/meta-ads
 *   /app/integrations/google-ads
 *
 * Chaque page propose un stepper visuel : ouvre le bon site, suis les étapes,
 * colle le token/ID, on vérifie côté serveur (POST /api/integrations/.../manual)
 * et on bascule sur un écran de succès animé.
 */
import { useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Facebook,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types & primitives partagées ─────────────────────────────────────────

type Step = {
  title: string;
  description: ReactNode;
  externalUrl?: string;
  externalLabel?: string;
};

type Result = { ok: true; message: string } | { ok: false; error: string } | null;

function Stepper({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-8 select-none">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={i} className="flex-1 flex items-center">
            <div className="flex flex-col items-center text-center flex-1 min-w-0">
              <div
                className={[
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                      : "bg-gray-200 text-gray-500",
                ].join(" ")}
              >
                {done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-gray-600 leading-tight truncate max-w-[120px]">
                {s.title}
              </div>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={[
                  "h-0.5 flex-1 mx-1 transition-colors",
                  done ? "bg-emerald-500" : "bg-gray-200",
                ].join(" ")}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link
          href="/app/integrations"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
          data-testid="link-back-integrations"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à Mes outils
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1 mb-8">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function SuccessScreen({ message, ctaHref = "/app/integrations" }: { message: string; ctaHref?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-sm animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
        <CheckCircle2 className="w-9 h-9 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Connexion réussie</h2>
      <p className="text-gray-600 mt-2 mb-6">{message}</p>
      <Link href={ctaHref}>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-back-to-tools">
          Retour à Mes outils
        </Button>
      </Link>
    </div>
  );
}

// ── Fetch helper using Clerk token ───────────────────────────────────────

function useAuthedPost() {
  const { getToken } = useAuth();
  return async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; data: { error?: string } & Record<string, unknown> }> => {
    const token = await getToken();
    const r = await fetch(`${basePath}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
    return { ok: r.ok && (data as { ok?: boolean }).ok !== false, data };
  };
}

// ── Generic page builder ────────────────────────────────────────────────

type ConnectPageConfig = {
  title: string;
  subtitle: string;
  steps: Step[]; // les N-1 premières étapes (la dernière "Vérifier" est ajoutée auto)
  finalStepTitle: string;
  finalLabel: string;
  placeholder: string;
  apiPath: string; // ex /api/integrations/facebook/manual
  bodyKey: string; // ex "accessToken" ou "customerId"
  buildSuccessMessage: (data: Record<string, unknown>) => string;
  brandColor: string; // tailwind bg- / hover-
  brandIcon?: ReactNode;
};

function ConnectPage(cfg: ConnectPageConfig) {
  const post = useAuthedPost();
  const [value, setValue] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const allSteps: Step[] = [
    ...cfg.steps,
    {
      title: cfg.finalStepTitle,
      description: cfg.finalLabel,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const { ok, data } = await post(cfg.apiPath, { [cfg.bodyKey]: value.trim() });
    setSubmitting(false);
    if (ok) {
      setResult({ ok: true, message: cfg.buildSuccessMessage(data) });
    } else {
      setResult({ ok: false, error: data.error ?? "Connexion échouée." });
    }
  };

  if (result?.ok) {
    return (
      <PageShell title={cfg.title} subtitle={cfg.subtitle}>
        <SuccessScreen message={result.message} />
      </PageShell>
    );
  }

  return (
    <PageShell title={cfg.title} subtitle={cfg.subtitle}>
      <Stepper steps={allSteps} currentIndex={currentStep} />

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Steps with instructions (all visible, current one highlighted) */}
        {cfg.steps.map((s, i) => (
          <div
            key={i}
            className={[
              "rounded-xl p-4 border transition-all",
              i === currentStep
                ? "border-indigo-300 bg-indigo-50/50"
                : i < currentStep
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-gray-200 bg-gray-50/50",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5",
                  i < currentStep
                    ? "bg-emerald-500 text-white"
                    : i === currentStep
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-300 text-gray-600",
                ].join(" ")}
              >
                {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm">{s.title}</h3>
                <div className="text-sm text-gray-600 mt-1">{s.description}</div>
                {s.externalUrl ? (
                  <a
                    href={s.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    data-testid={`link-external-step-${i}`}
                    onClick={() => {
                      if (i === currentStep && i < cfg.steps.length - 1) {
                        setCurrentStep(i + 1);
                      }
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {s.externalLabel ?? "Ouvrir dans un nouvel onglet"}
                  </a>
                ) : null}
                {i === currentStep && !s.externalUrl && i < cfg.steps.length - 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setCurrentStep(i + 1)}
                    data-testid={`button-next-step-${i}`}
                  >
                    Étape suivante
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {/* Final step : paste & verify */}
        <form
          onSubmit={handleSubmit}
          className={[
            "rounded-xl p-4 border-2 transition-all",
            currentStep >= cfg.steps.length
              ? "border-indigo-400 bg-indigo-50/50"
              : "border-dashed border-gray-300 bg-gray-50/30",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <div
              className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5",
                currentStep >= cfg.steps.length
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-300 text-gray-600",
              ].join(" ")}
            >
              {allSteps.length}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm">{cfg.finalStepTitle}</h3>
              <p className="text-sm text-gray-600 mt-1 mb-3">{cfg.finalLabel}</p>
              <div className="space-y-3">
                <Label htmlFor="manual-value" className="sr-only">
                  Valeur
                </Label>
                <Input
                  id="manual-value"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (e.target.value.length > 0 && currentStep < cfg.steps.length) {
                      setCurrentStep(cfg.steps.length);
                    }
                  }}
                  placeholder={cfg.placeholder}
                  className="font-mono text-sm"
                  data-testid="input-manual-value"
                  autoComplete="off"
                  spellCheck={false}
                />
                {result && !result.ok ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {result.error}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  disabled={submitting || value.trim().length < 5}
                  className={`${cfg.brandColor} text-white w-full sm:w-auto`}
                  data-testid="button-verify-connect"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      {cfg.brandIcon ? <span className="mr-2">{cfg.brandIcon}</span> : null}
                      Vérifier et connecter
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </PageShell>
  );
}

// ── 4 pages ──────────────────────────────────────────────────────────────

export function FacebookConnectPage() {
  return (
    <ConnectPage
      title="Connecter Facebook & Instagram"
      subtitle="Suis les étapes pour générer ton token d'accès Meta, puis colle-le ici. On vérifie et on enregistre tout pour toi."
      steps={[
        {
          title: "Ouvre Facebook Developers",
          description:
            "On va t'envoyer dans l'outil officiel Meta pour générer ton token.",
          externalUrl: "https://developers.facebook.com/tools/explorer",
          externalLabel: "Ouvrir Facebook Developers",
        },
        {
          title: "Coche les permissions",
          description: (
            <>
              En haut à droite de l'outil, sélectionne ton app GrowIQ. Puis dans « Add a Permission », coche
              au minimum : <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">pages_show_list</span>,
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">pages_manage_posts</span>,
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">instagram_basic</span>,
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">instagram_content_publish</span>.
            </>
          ),
        },
        {
          title: "Génère le token (très important : token Utilisateur)",
          description: (
            <>
              Dans le menu déroulant en haut à droite, choisis bien{" "}
              <span className="font-semibold">« User Token » (token utilisateur)</span> — surtout PAS un token de Page,
              sinon la connexion échouera. Clique ensuite sur{" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">Generate Access Token</span>,
              connecte-toi avec ton Facebook et autorise l'accès à ta page.
            </>
          ),
        },
      ]}
      finalStepTitle="Colle ton token ici"
      finalLabel="Copie le « Access Token » (token utilisateur) qui apparaît tout en haut de la page Facebook Developers et colle-le ci-dessous."
      placeholder="EAAxxxxxxxxx..."
      apiPath="/api/integrations/facebook/manual"
      bodyKey="accessToken"
      buildSuccessMessage={(d) => {
        const page = (d.pageName as string | undefined) ?? "Ta page";
        const ig = d.instagramUsername as string | null | undefined;
        return ig
          ? `${page} et Instagram @${ig} sont connectés. Tu peux maintenant publier.`
          : `${page} est connectée. Pour publier aussi sur Instagram, lie ton compte IG Business à ta page Facebook.`;
      }}
      brandColor="bg-[#1877F2] hover:bg-[#1465D6]"
      brandIcon={<Facebook className="w-4 h-4" />}
    />
  );
}

export function LinkedinConnectPage() {
  return (
    <ConnectPage
      title="Connecter LinkedIn"
      subtitle="Génère un token d'accès LinkedIn et colle-le ici. On vérifie et on enregistre tout pour toi."
      steps={[
        {
          title: "Ouvre LinkedIn Developers",
          description:
            "On va t'envoyer dans le portail Developers de LinkedIn. Connecte-toi avec ton compte LinkedIn.",
          externalUrl: "https://www.linkedin.com/developers/apps",
          externalLabel: "Ouvrir LinkedIn Developers",
        },
        {
          title: "Ouvre ton app → onglet Auth",
          description: (
            <>
              Clique sur ton app GrowIQ dans la liste, puis va dans l'onglet <span className="font-semibold">Auth</span>.
              Vérifie que les permissions <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">openid</span>,
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">profile</span>,
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">email</span> et
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">w_member_social</span> sont activées.
            </>
          ),
        },
        {
          title: "Génère un token",
          description:
            "Dans l'onglet Auth, clique sur « Generate token ». Coche les permissions ci-dessus puis copie le token qui s'affiche.",
        },
      ]}
      finalStepTitle="Colle ton token ici"
      finalLabel="Colle le token LinkedIn généré ci-dessous (il commence souvent par AQ...)."
      placeholder="AQxxxxxxxxx..."
      apiPath="/api/integrations/linkedin/manual"
      bodyKey="accessToken"
      buildSuccessMessage={(d) => {
        const name = (d.name as string | undefined) ?? "Ton profil";
        return `${name} est connecté. Tu peux publier sur LinkedIn depuis l'agence.`;
      }}
      brandColor="bg-[#0A66C2] hover:bg-[#0958A8]"
      brandIcon={<Linkedin className="w-4 h-4" />}
    />
  );
}

export function MetaAdsConnectPage() {
  return (
    <ConnectPage
      title="Connecter Meta Ads"
      subtitle="Renseigne ton compte publicitaire Meta pour pouvoir booster tes posts. Tu dois avoir connecté Facebook avant."
      steps={[
        {
          title: "Ouvre Meta Business Manager",
          description:
            "On t'envoie dans Business Manager. Connecte-toi avec le même compte Facebook que tu as connecté à GrowIQ.",
          externalUrl: "https://business.facebook.com",
          externalLabel: "Ouvrir Meta Business Manager",
        },
        {
          title: "Va dans Paramètres → Comptes publicitaires",
          description:
            "Dans la barre latérale, ouvre « Paramètres de l'entreprise ». Puis dans le menu, clique sur « Comptes publicitaires ».",
        },
        {
          title: "Note ton Ad Account ID",
          description: (
            <>
              Sélectionne ton compte publicitaire dans la liste. L'ID s'affiche en haut, au format
              {" "}
              <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">act_xxxxxxxxxx</span>.
              Copie-le entièrement, avec le préfixe « act_ ».
            </>
          ),
        },
      ]}
      finalStepTitle="Colle ton Ad Account ID ici"
      finalLabel="Format attendu : act_ suivi de chiffres (ex: act_1234567890)."
      placeholder="act_1234567890"
      apiPath="/api/integrations/meta-ads/manual"
      bodyKey="adAccountId"
      buildSuccessMessage={(d) => {
        const name = (d.name as string | undefined) ?? "Ton compte publicitaire";
        const cur = d.currency as string | null | undefined;
        return cur
          ? `${name} (${cur}) est connecté. Tu peux maintenant booster tes posts en payant.`
          : `${name} est connecté. Tu peux maintenant booster tes posts en payant.`;
      }}
      brandColor="bg-[#1877F2] hover:bg-[#1465D6]"
      brandIcon={<Facebook className="w-4 h-4" />}
    />
  );
}

export function GoogleAdsConnectPage() {
  return (
    <ConnectPage
      title="Connecter Google Ads"
      subtitle="Renseigne ton Customer ID Google Ads. On l'enregistre pour préparer tes campagnes Search."
      steps={[
        {
          title: "Ouvre Google Ads",
          description:
            "On t'envoie sur ads.google.com. Connecte-toi avec le compte Google qui gère tes campagnes.",
          externalUrl: "https://ads.google.com",
          externalLabel: "Ouvrir Google Ads",
        },
        {
          title: "Note ton Customer ID",
          description: (
            <>
              Une fois dans Google Ads, ton Customer ID s'affiche tout en haut à droite, à côté de ton email.
              Format : <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">xxx-xxx-xxxx</span>{" "}
              (10 chiffres séparés par des tirets).
            </>
          ),
        },
      ]}
      finalStepTitle="Colle ton Customer ID ici"
      finalLabel="Format attendu : xxx-xxx-xxxx (ex: 123-456-7890)."
      placeholder="123-456-7890"
      apiPath="/api/integrations/google-ads/manual"
      bodyKey="customerId"
      buildSuccessMessage={(d) => {
        const id = (d.customerId as string | undefined) ?? "Ton Customer ID";
        return `Customer ID ${id} enregistré. Les vraies campagnes seront activées dès la validation API Google.`;
      }}
      brandColor="bg-[#4285F4] hover:bg-[#3367D6]"
      brandIcon={<span className="font-bold text-base leading-none">G</span>}
    />
  );
}
