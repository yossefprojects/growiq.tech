import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import LandingPage from "@/pages/landing";
import HomePage from "@/pages/home";
import AgencyPage from "@/pages/agency";
import IntegrationsPage from "@/pages/integrations";
import {
  FacebookConnectPage,
  LinkedinConnectPage,
  MetaAdsConnectPage,
  GoogleAdsConnectPage,
} from "@/pages/integrations-connect";
import SeoPage from "@/pages/seo";
import EmailsPage from "@/pages/emails";
import AdminPage from "@/pages/admin";
import AccountPage from "@/pages/account";
import DashboardPage from "@/pages/dashboard";
import GoogleAdsApiPage from "@/pages/google-ads-api";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import ContactPage from "@/pages/contact";
import { SignInPage, SignUpPage } from "@/pages/auth-pages";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#5b54d6",
    colorForeground: "#f4f4f6",
    colorMutedForeground: "#9ca3af",
    colorDanger: "#f87171",
    colorBackground: "#0f0f1a",
    colorInput: "#15151f",
    colorInputForeground: "#f4f4f6",
    colorNeutral: "#ffffff",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0f0f1a] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl border border-white/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white text-2xl font-extrabold",
    headerSubtitle: "text-[#9ca3af] text-sm",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-white text-sm font-semibold",
    footerActionLink: "text-[#8b84ff] hover:text-[#a99fff] font-semibold",
    footerActionText: "text-[#9ca3af]",
    dividerText: "text-[#9ca3af] text-xs uppercase tracking-wider",
    identityPreviewEditButton: "text-[#8b84ff]",
    formFieldSuccessText: "text-[#3dbf8e]",
    alertText: "text-white",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-12 w-12",
    socialButtonsBlockButton: "border border-white/10 hover:bg-white/5 transition-colors",
    formButtonPrimary: "bg-[#5b54d6] hover:bg-[#4a44b8] text-white font-semibold shadow-sm",
    formFieldInput: "border border-white/10 bg-white/5 focus:border-[#5b54d6] focus:ring-2 focus:ring-[#5b54d6]/30",
    footerAction: "text-center",
    dividerLine: "bg-white/10",
    alert: "border border-red-500/30 bg-red-500/10",
    otpCodeFieldInput: "border border-white/10 focus:border-[#5b54d6]",
    formFieldRow: "",
    main: "gap-4",
  },
};

const clerkLocalization = {
  signIn: {
    start: {
      title: "Bon retour parmi nous",
      subtitle: "Connecte-toi pour retrouver ton agent marketing",
    },
  },
  signUp: {
    start: {
      title: "Crée ton compte GrowIQ",
      subtitle: "Ton stratège marketing en quelques clics",
    },
  },
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/app" />
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
}

type MeResponse = { userId: string; email: string | null; isAdmin: boolean };
type MeState =
  | { kind: "ok"; data: MeResponse }
  | { kind: "unauthenticated" }
  | { kind: "network_error" };

function AdminGate({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { data, isLoading } = useQuery<MeState>({
    queryKey: ["me"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${basePath}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) return { kind: "unauthenticated" };
      if (!res.ok) return { kind: "network_error" };
      return { kind: "ok", data: (await res.json()) as MeResponse };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (data.kind === "unauthenticated") {
    return <Redirect to="/sign-in" />;
  }
  if (data.kind === "network_error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-foreground font-semibold mb-2">
            Connexion au serveur impossible.
          </p>
          <p className="text-sm text-muted-foreground">
            Vérifie ta connexion et recharge la page.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <AdminGate>{children}</AdminGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

const CANONICAL_ORIGIN = "https://growiq.tech";

/**
 * Met à jour dynamiquement <link rel="canonical"> et og:url à chaque
 * changement de route. Sans ça, toutes les pages héritent du canonical
 * codé en dur dans index.html (la home), ce que Lighthouse signale comme
 * "rel=canonical invalide : pointe vers la racine au lieu de la page".
 * On normalise sur le domaine de prod pour que l'URL canonique reste
 * stable quel que soit l'environnement (dev Replit vs prod).
 */
function CanonicalTag() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location === "/" ? "" : location.replace(/\/+$/, "");
    const url = path ? `${CANONICAL_ORIGIN}${path}` : `${CANONICAL_ORIGIN}/`;

    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    const ogUrl = document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]',
    );
    if (ogUrl) ogUrl.content = url;
  }, [location]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/app">{() => <RequireAuth><DashboardPage /></RequireAuth>}</Route>
      <Route path="/app/chat">{() => <RequireAuth><ChatPage /></RequireAuth>}</Route>
      <Route path="/app/agency">{() => <RequireAuth><AgencyPage /></RequireAuth>}</Route>
      <Route path="/app/integrations">{() => <RequireAuth><IntegrationsPage /></RequireAuth>}</Route>
      <Route path="/app/integrations/facebook">{() => <RequireAuth><FacebookConnectPage /></RequireAuth>}</Route>
      <Route path="/app/integrations/linkedin">{() => <RequireAuth><LinkedinConnectPage /></RequireAuth>}</Route>
      <Route path="/app/integrations/meta-ads">{() => <RequireAuth><MetaAdsConnectPage /></RequireAuth>}</Route>
      <Route path="/app/integrations/google-ads">{() => <RequireAuth><GoogleAdsConnectPage /></RequireAuth>}</Route>
      <Route path="/app/seo">{() => <RequireAuth><SeoPage /></RequireAuth>}</Route>
      <Route path="/app/emails">{() => <RequireAuth><EmailsPage /></RequireAuth>}</Route>
      <Route path="/app/admin">{() => <RequireAuth><AdminPage /></RequireAuth>}</Route>
      <Route path="/app/account">{() => <RequireAuth><AccountPage /></RequireAuth>}</Route>
      <Route path="/app/conversations/:id">{() => <RequireAuth><ChatPage /></RequireAuth>}</Route>
      <Route path="/landing/:slug" component={LandingPage} />
      <Route path="/google-ads-api" component={GoogleAdsApiPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <I18nProvider>
          <TooltipProvider>
            <CanonicalTag />
            <Router />
            <SonnerToaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

/**
 * Global error boundary. Sans ça, le moindre crash dans un sous-composant
 * (ex : data.foo.bar quand foo est undefined) blanche l'écran entier.
 * Ici on capture, on log dans la console, et on affiche une page lisible
 * avec un bouton "Recharger". Évite de re-vivre l'incident "Megaphone is not
 * defined" / "Cannot read properties of undefined".
 */
type EBState = { error: Error | null };
class GlobalErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[GlobalErrorBoundary]", error, info);
  }
  reset = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };
  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full text-center">
          <p className="text-2xl font-extrabold text-foreground mb-2">
            Oups, ça a planté.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            On a été prévenus. Recharge la page pour repartir.
          </p>
          <button
            onClick={this.reset}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[#5b54d6] hover:bg-[#4a44b8] text-white font-semibold shadow-sm"
          >
            Recharger la page
          </button>
          <details className="mt-6 text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer">Détails techniques</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words bg-card p-3 rounded border border-border">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

function App() {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
