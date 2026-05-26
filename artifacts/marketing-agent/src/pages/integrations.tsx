import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PlatformStatus = { configured: boolean; missing: string[] };
type AdsStatus = { meta: PlatformStatus; google: PlatformStatus };

const SECRET_LABELS: Record<string, string> = {
  META_ACCESS_TOKEN: "Jeton d'accès Facebook (avec permission ads_management)",
  META_AD_ACCOUNT_ID: "Identifiant du compte publicitaire (act_xxxxxxxxxx)",
  GOOGLE_ADS_DEVELOPER_TOKEN: "Developer Token Google Ads",
  GOOGLE_ADS_CLIENT_ID: "Identifiant client OAuth Google",
  GOOGLE_ADS_CLIENT_SECRET: "Secret client OAuth Google",
  GOOGLE_ADS_REFRESH_TOKEN: "Refresh Token Google",
  GOOGLE_ADS_CUSTOMER_ID: "Identifiant du compte Google Ads (10 chiffres)",
};

function StatusBadge({ state }: { state: "ready" | "pending" | "missing" }) {
  if (state === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#3dbf8e]/15 text-[#1a7a55]">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Prêt
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        <Clock className="w-3.5 h-3.5" />
        En attente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      <XCircle className="w-3.5 h-3.5" />
      À configurer
    </span>
  );
}

type PlatformCardProps = {
  name: string;
  description: string;
  status: PlatformStatus | undefined;
  nextStep: {
    title: string;
    body: React.ReactNode;
    linkLabel: string;
    linkUrl: string;
  };
};

function PlatformCard({ name, description, status, nextStep }: PlatformCardProps) {
  const state: "ready" | "pending" | "missing" = !status
    ? "missing"
    : status.configured
      ? "ready"
      : status.missing.length > 0
        ? "pending"
        : "missing";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <StatusBadge state={state} />
      </div>

      {status?.configured ? (
        <div className="mt-4 rounded-lg bg-[#3dbf8e]/10 border border-[#3dbf8e]/30 p-3 text-sm text-[#1a7a55]">
          Tout est configuré. Tu peux lancer des campagnes payantes sur cette plateforme.
        </div>
      ) : (
        <>
          {status && status.missing.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Ce qui manque encore
              </p>
              <ul className="space-y-1.5">
                {status.missing.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <XCircle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-foreground">
                      {SECRET_LABELS[key] ?? key}
                      <code className="ml-2 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {key}
                      </code>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-[#5b54d6]/5 border border-[#5b54d6]/20 p-4">
            <p className="text-sm font-semibold text-[#1e1b4b] mb-1">{nextStep.title}</p>
            <div className="text-sm text-foreground/80 leading-relaxed">{nextStep.body}</div>
            <a
              href={nextStep.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-[#5b54d6] hover:text-[#4d46c4]"
            >
              {nextStep.linkLabel}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const { getToken } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AdsStatus>({
    queryKey: ["ads-status"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${basePath}/api/ads/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("status failed");
      return (await res.json()) as AdsStatus;
    },
    staleTime: 30_000,
  });

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
            Publicités payantes
          </h1>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            data-testid="button-refresh-status"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          État des intégrations Facebook Ads et Google Ads. Tant que les validations
          ne sont pas terminées, on ne peut pas lancer de campagnes payantes — seuls
          les posts gratuits (organiques) fonctionnent.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#5b54d6]" />
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Impossible de récupérer l'état des intégrations. Recharge la page.
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {isError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                La dernière actualisation a échoué — les informations ci-dessous datent de la dernière vérification réussie.
              </div>
            )}
            <PlatformCard
              name="Facebook & Instagram Ads"
              description="Booster un post organique en publicité ciblée payante."
              status={data.meta}
              nextStep={{
                title: "Prochaine étape",
                body: (
                  <ol className="list-decimal list-inside space-y-1 mt-1">
                    <li>Créer (ou activer) un Business Manager Meta.</li>
                    <li>
                      Vérifier l'entreprise (Business Verification) — un justificatif
                      officiel suffit.
                    </li>
                    <li>
                      Soumettre la permission <code className="text-xs bg-muted px-1 py-0.5 rounded">ads_management</code> à
                      l'App Review Meta.
                    </li>
                    <li>
                      Une fois approuvé, on ajoute le secret{" "}
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">META_AD_ACCOUNT_ID</code> et
                      on régénère le jeton.
                    </li>
                  </ol>
                ),
                linkLabel: "Ouvrir Meta for Developers",
                linkUrl: "https://developers.facebook.com/apps/",
              }}
            />

            <PlatformCard
              name="Google Ads"
              description="Lancer des campagnes Search (résultats de recherche Google)."
              status={data.google}
              nextStep={{
                title: "Prochaine étape",
                body: (
                  <>
                    <p>
                      Demande de Developer Token Basic Access en cours d'examen par Google
                      (dossier <strong>2-7523000040163</strong>). Délai annoncé : 2 à 6 semaines.
                    </p>
                    <p className="mt-2">
                      Google enverra un email à l'adresse qui a fait la demande dès que le statut change.
                      Une fois approuvé, on configure les 5 secrets restants (OAuth + customer ID).
                    </p>
                  </>
                ),
                linkLabel: "Voir le suivi du dossier Google",
                linkUrl: "https://support.google.com/google-ads/contact/api_developer_token",
              }}
            />
          </div>
        )}

        <div className="mt-10 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>
            En attendant ces validations, l'agent continue de publier gratuitement tes
            posts sur Facebook et Instagram. La publicité payante viendra s'ajouter
            par-dessus une fois les comptes activés.
          </p>
        </div>
      </main>
    </div>
  );
}
