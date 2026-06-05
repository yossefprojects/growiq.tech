import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import {
  useListOpenaiConversations,
  useListOpenaiCampaigns,
  useDeleteOpenaiConversation,
  useDeleteOpenaiCampaign,
  useGetOpenaiBusinessProfile,
  getListOpenaiConversationsQueryKey,
  getListOpenaiCampaignsQueryKey,
  getGetOpenaiBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { toastError } from "@/lib/toast-helpers";
import { HelpTip } from "@/components/help-tip";
import {
  Rocket,
  CalendarClock,
  MessageCircle,
  ListChecks,
  Menu,
  ArrowRight,
  Sparkles,
  Mail,
  Plug,
} from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { CampaignLaunchModal } from "@/components/campaign-launch-modal";
import { ToolboxModal } from "@/components/toolbox-modal";
import { WelcomeTour, shouldShowWelcomeTour } from "@/components/welcome-tour";
import { OnboardingWizard, shouldShowOnboarding } from "@/components/onboarding-wizard";
import { BrandIcon, BrandWordmark } from "@/components/brand-logo";
import { AdminIconButton } from "@/components/admin-button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useEffect } from "react";

type ActionCard = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  iconBg: string;
  onClick: () => void;
  testId: string;
  help?: string;
};

type IntegrationsSummary = {
  facebook: { connected: boolean };
  linkedin: { connected: boolean };
  resend: { connected: boolean };
};

const basePathDashboard = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { t, language } = useI18n();

  // Carte onboarding "Connecte tes outils" si rien de configuré.
  // Ne bloque pas l'UI : on l'affiche en bandeau au-dessus des actions.
  const { data: integrationsSummary } = useQuery<IntegrationsSummary>({
    queryKey: ["integrations", "summary"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${basePathDashboard}/api/integrations`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as IntegrationsSummary;
    },
    staleTime: 60_000,
  });
  const noIntegration =
    !!integrationsSummary &&
    !integrationsSummary.facebook?.connected &&
    !integrationsSummary.linkedin?.connected &&
    !integrationsSummary.resend?.connected;

  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: profile, isLoading: profileLoading } = useGetOpenaiBusinessProfile({
    query: { queryKey: getGetOpenaiBusinessProfileQueryKey() },
  });

  useEffect(() => {
    if (profileLoading) return;
    const onboardingPending = shouldShowOnboarding(
      true,
      profile?.onboardingCompleted ?? false,
    );
    if (onboardingPending) {
      const timer = setTimeout(() => setShowOnboarding(true), 300);
      return () => clearTimeout(timer);
    }
    if (!shouldShowWelcomeTour()) return;
    const timer = setTimeout(() => setShowWelcome(true), 400);
    return () => clearTimeout(timer);
  }, [profileLoading, profile?.onboardingCompleted]);

  const { data: conversations = [], isLoading: convLoading } =
    useListOpenaiConversations({
      query: { queryKey: getListOpenaiConversationsQueryKey() },
    });
  const { data: campaignsData, isLoading: campLoading } = useListOpenaiCampaigns({
    query: { queryKey: getListOpenaiCampaignsQueryKey() },
  });
  const campaigns = campaignsData ?? [];

  const deleteConv = useDeleteOpenaiConversation();
  const deleteCamp = useDeleteOpenaiCampaign();

  const handleDeleteConversation = useCallback(
    (id: number) => {
      deleteConv.mutate(
        { id },
        {
          onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() }),
          onError: (err) => toastError(err, t("Impossible de supprimer la conversation")),
        },
      );
    },
    [deleteConv, queryClient, t],
  );

  const handleDeleteCampaign = useCallback(
    (id: number) => {
      deleteCamp.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOpenaiCampaignsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          },
          onError: (err) => toastError(err, t("Impossible de supprimer la campagne")),
        },
      );
    },
    [deleteCamp, queryClient, t],
  );

  const actions: ActionCard[] = [
    {
      title: t("Lancer une campagne"),
      description: t("L'agent prépare tout : visuels, posts, emails. Tu valides, c'est publié."),
      icon: Rocket,
      bg: "bg-gradient-to-br from-[#5b54d6] to-[#7c6cf0] text-white",
      iconBg: "bg-white/20",
      onClick: () => setLocation("/app/agency"),
      testId: "action-launch-campaign",
      help: t("L'agence automatique te pose 3 questions, choisit les réseaux et horaires, génère les visuels et le texte, puis publie sur Facebook et Instagram à ta validation."),
    },
    {
      title: t("Programmer un post"),
      description: t("Choisis le réseau, la date, l'heure. On s'occupe du reste."),
      icon: CalendarClock,
      bg: "bg-gradient-to-br from-[#3dbf8e] to-[#5dd4a6] text-white",
      iconBg: "bg-white/20",
      onClick: () => setToolboxOpen(true),
      testId: "action-schedule-post",
      help: t("Ouvre la boîte à outils pour programmer un post simple (texte + image) à une date et heure précises, sans passer par l'agence complète."),
    },
    {
      title: t("Parler à l'agent"),
      description: t("Pose une question marketing, demande une idée, brainstorme."),
      icon: MessageCircle,
      bg: "bg-gradient-to-br from-[#1e1b4b] to-[#3a3470] text-white",
      iconBg: "bg-white/20",
      onClick: () => setLocation("/app/chat"),
      testId: "action-open-chat",
      help: t("Une conversation libre avec un stratège marketing senior. Idéal pour réfléchir, poser des questions précises ou faire valider une idée."),
    },
    {
      title: t("Emails & contacts"),
      description: t("Gère ta base d'abonnés et retrouve les stats de tes campagnes emailing."),
      icon: Mail,
      bg: "bg-gradient-to-br from-amber-500/15 to-amber-400/10 text-foreground",
      iconBg: "bg-[#d97706]/15 text-[#d97706]",
      onClick: () => setLocation("/app/emails"),
      testId: "action-emails",
      help: t("Ajoute ou importe tes contacts, et consulte ouvertures et clics des campagnes que tu as envoyées depuis l'agence."),
    },
    {
      title: t("Mes campagnes"),
      description: t("Retrouve toutes tes campagnes et leurs résultats."),
      icon: ListChecks,
      bg: "bg-gradient-to-br from-violet-500/15 to-blue-500/10 text-foreground",
      iconBg: "bg-[#5b54d6]/15 text-[#5b54d6]",
      onClick: () => {
        const el = document.getElementById("recent-campaigns");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      testId: "action-my-campaigns",
      help: t("Toutes tes campagnes générées par l'agence, avec leur statut (en cours, programmée, publiée) et la possibilité de les rouvrir."),
    },
  ];

  const sidebarProps = {
    conversations,
    campaigns,
    activeId: null,
    onNew: () => {
      setMobileNavOpen(false);
      setLocation("/app/chat");
    },
    onLaunchCampaign: () => {
      setMobileNavOpen(false);
      setCampaignModalOpen(true);
    },
    onDelete: handleDeleteConversation,
    onDeleteCampaign: handleDeleteCampaign,
    onShowDemo: () => setShowWelcome(true),
    isLoading: convLoading || campLoading,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 flex">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex h-screen sticky top-0">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — mobile + tablet */}
        <header className="lg:hidden sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
          <div className="flex items-center justify-between px-4 h-14">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
                  aria-label={t("Ouvrir le menu")}
                  data-testid="mobile-menu-trigger"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 sm:w-80">
                <SheetTitle className="sr-only">{t("Menu")}</SheetTitle>
                <Sidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-2">
              <BrandIcon size={28} className="drop-shadow-sm" />
              <BrandWordmark className="text-base" />
            </Link>
            <AdminIconButton variant="ghost" />
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-5xl mx-auto w-full">
          {/* Greeting */}
          <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5b54d6]/10 text-[#5b54d6] text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                {t("Stratège marketing senior, disponible 24/7")}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                {t("Bonjour ! Que veux-tu faire aujourd'hui ?")}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                {t("Choisis une action ci-dessous, ou décris simplement ton besoin dans le chat.")}
              </p>
            </div>
            <AdminIconButton variant="solid" className="mt-1" />
          </div>

          {/* Onboarding banner — visible tant qu'aucune intégration n'est connectée */}
          {noIntegration ? (
            <button
              onClick={() => setLocation("/app/integrations")}
              data-testid="onboarding-connect-tools"
              className="w-full mb-6 group relative overflow-hidden rounded-2xl p-5 sm:p-6 text-left bg-gradient-to-br from-amber-500/15 to-amber-400/10 text-foreground shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-xl bg-white/10 p-3">
                  <Plug className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg sm:text-xl mb-1">
                    {t("Commence par connecter tes réseaux")}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("L'agent a besoin d'un accès à tes comptes Facebook, LinkedIn ou Resend pour publier en ton nom. Ça prend 1 minute.")}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 mt-1 shrink-0 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ) : null}

          {/* Action cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-10">
            {actions.map((a) => (
              <button
                key={a.title}
                onClick={a.onClick}
                data-testid={a.testId}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-5 sm:p-6 text-left",
                  "shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-[#5b54d6] focus:ring-offset-2",
                  a.bg,
                )}
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-3", a.iconBg)}>
                  <a.icon className="w-5 h-5" />
                </div>
                <div className="font-bold text-base sm:text-lg leading-snug mb-1">{a.title}</div>
                <div className="text-xs sm:text-sm opacity-85 leading-relaxed">{a.description}</div>
                <ArrowRight className="absolute top-5 right-5 w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
                {a.help && (
                  <span className="absolute bottom-3 right-3">
                    <HelpTip text={a.help} side="top" className="text-white/70 hover:text-white hover:bg-white/15" />
                  </span>
                )}
              </button>
            ))}
          </section>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-10">
            {[
              { label: t("Conversations"), value: conversations.length },
              { label: t("Campagnes"), value: campaigns.length },
              { label: t("Posts programmés"), value: "—" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border/60 bg-card px-4 py-3 sm:px-5 sm:py-4"
              >
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {s.value}
                </div>
                <div className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Recent campaigns */}
          <section id="recent-campaigns" className="mb-10 scroll-mt-20">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">{t("Tes dernières campagnes")}</h2>
              {campaigns.length > 5 && (
                <span className="text-xs text-muted-foreground">{t("{count} au total", { count: campaigns.length })}</span>
              )}
            </div>
            {campLoading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">{t("Chargement…")}</div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 py-8 px-4 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  {t("Tu n'as pas encore de campagne. Lance-toi !")}
                </p>
                <button
                  onClick={() => setLocation("/app/agency")}
                  className="inline-flex items-center gap-1.5 bg-[#5b54d6] hover:bg-[#4d46c4] text-white rounded-md px-4 py-2 text-sm font-semibold transition-colors"
                  data-testid="empty-launch-campaign"
                >
                  <Rocket className="w-4 h-4" />
                  {t("Créer ma première campagne")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={c.conversationId ? `/app/conversations/${c.conversationId}` : "/app/chat"}
                    className="block rounded-xl border border-border/60 bg-card hover:border-[#5b54d6]/40 hover:shadow-md transition-all px-4 py-3 group"
                    data-testid={`campaign-card-${c.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#5b54d6]/10 text-[#5b54d6] flex items-center justify-center shrink-0">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString(language === "en" ? "en-US" : "fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-[#5b54d6] transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recent conversations */}
          {conversations.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-3">
                {t("Conversations récentes")}
              </h2>
              <div className="space-y-1.5">
                {conversations.slice(0, 4).map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/app/conversations/${conv.id}`}
                    className="flex items-center gap-3 rounded-lg hover:bg-muted px-3 py-2 transition-colors group"
                    data-testid={`conv-card-${conv.id}`}
                  >
                    <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{conv.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Modals */}
      <CampaignLaunchModal
        open={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCampaignCreated={() => {
          setCampaignModalOpen(false);
          queryClient.invalidateQueries({ queryKey: getListOpenaiCampaignsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        }}
      />
      <ToolboxModal open={toolboxOpen} onClose={() => setToolboxOpen(false)} />
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />
      <WelcomeTour open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
}
