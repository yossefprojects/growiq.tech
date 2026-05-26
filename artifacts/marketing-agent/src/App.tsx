import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import LandingPage from "@/pages/landing";
import HomePage from "@/pages/home";
import AgencyPage from "@/pages/agency";
import DashboardPage from "@/pages/dashboard";
import AccessPendingPage from "@/pages/access-pending";
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
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#5b54d6",
    colorForeground: "#1e1b4b",
    colorMutedForeground: "#6b7280",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#1e1b4b",
    colorNeutral: "#e5e7eb",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[#ede9fe]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#1e1b4b] text-2xl font-extrabold",
    headerSubtitle: "text-[#6b7280] text-sm",
    socialButtonsBlockButtonText: "text-[#1e1b4b] font-medium",
    formFieldLabel: "text-[#1e1b4b] text-sm font-semibold",
    footerActionLink: "text-[#5b54d6] hover:text-[#4a44b8] font-semibold",
    footerActionText: "text-[#6b7280]",
    dividerText: "text-[#9ca3af] text-xs uppercase tracking-wider",
    identityPreviewEditButton: "text-[#5b54d6]",
    formFieldSuccessText: "text-[#3dbf8e]",
    alertText: "text-[#1e1b4b]",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-12 w-12",
    socialButtonsBlockButton: "border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors",
    formButtonPrimary: "bg-[#5b54d6] hover:bg-[#4a44b8] text-white font-semibold shadow-sm",
    formFieldInput: "border border-[#e5e7eb] focus:border-[#5b54d6] focus:ring-2 focus:ring-[#5b54d6]/20",
    footerAction: "text-center",
    dividerLine: "bg-[#e5e7eb]",
    alert: "border border-[#fee2e2] bg-[#fef2f2]",
    otpCodeFieldInput: "border border-[#e5e7eb] focus:border-[#5b54d6]",
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

function AdminGate({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${basePath}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load profile");
      return (await res.json()) as { userId: string; email: string | null; isAdmin: boolean };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#5b54d6]" />
      </div>
    );
  }
  if (isError || !data) {
    return <AccessPendingPage email={null} />;
  }
  if (!data.isAdmin) {
    return <AccessPendingPage email={data.email} />;
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/app">{() => <RequireAuth><DashboardPage /></RequireAuth>}</Route>
      <Route path="/app/chat">{() => <RequireAuth><ChatPage /></RequireAuth>}</Route>
      <Route path="/app/agency">{() => <RequireAuth><AgencyPage /></RequireAuth>}</Route>
      <Route path="/app/conversations/:id">{() => <RequireAuth><ChatPage /></RequireAuth>}</Route>
      <Route path="/landing/:slug" component={LandingPage} />
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
        <TooltipProvider>
          <Router />
          <SonnerToaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
