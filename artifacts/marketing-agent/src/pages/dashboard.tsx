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
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Rocket,
  Zap,
  CalendarClock,
  MessageCircle,
  ListChecks,
  Menu,
  ArrowRight,
  Sparkles,
  Mail,
  Plug,
  Palette,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { CampaignLaunchModal } from "@/components/campaign-launch-modal";
import { ToolboxModal } from "@/components/toolbox-modal";
import { WelcomeTour, shouldShowWelcomeTour } from "@/components/welcome-tour";
import { OnboardingWizard, shouldShowOnboarding } from "@/components/onboarding-wizard";
import { BrandIcon, BrandWordmark } from "@/components/brand-logo";
import { AdminIconButton } from "@/components/admin-button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useEffect } from "react";

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
              <SheetContent side="left" className="p-0 w-[85vw] sm:w-72">
                <SheetTitle className="sr-only">{t("Menu")}</SheetTitle>
                <Sidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-2">
              <BrandIcon size={28} className="drop-shadow-sm" />
              <BrandWordmark className="text-base" />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle testId="theme-toggle-header" />
              <AdminIconButton variant="ghost" />
            </div>
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

          {/* Action cards — hiérarchie : hero "Lancer une campagne" + cartes secondaires */}
          <section className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 mb-10">
            {/* Hero — Lancer une campagne */}
            <button
              onClick={() => setLocation("/app/agency")}
              data-testid="action-launch-campaign"
              className="group relative overflow-hidden text-left flex flex-col justify-between min-h-[220px] md:min-h-[280px] p-8 sm:p-10 rounded-[20px] text-white transition-all duration-300 hover:-translate-y-[3px] hover:brightness-110 hover:shadow-[0_20px_50px_rgba(91,84,214,0.45)] focus:outline-none focus:ring-2 focus:ring-[#5b54d6] focus:ring-offset-2 focus:ring-offset-background"
              style={{ background: "linear-gradient(135deg, #5B54D6 0%, #C026D3 100%)" }}
            >
              {/* Particules décoratives */}
              <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 w-[200px] h-[200px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span aria-hidden className="pointer-events-none absolute bottom-4 -left-10 w-[120px] h-[120px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-20 w-[80px] h-[80px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />

              <ArrowRight className="absolute top-6 right-6 w-5 h-5 group-hover:translate-x-1 transition-transform" style={{ color: "rgba(255,255,255,0.4)" }} />

              <div className="relative">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <Zap className="w-7 h-7" />
                </div>
                <div className="text-2xl font-extrabold mb-2">{t("Lancer une campagne")}</div>
                <p className="text-[15px] leading-relaxed max-w-md" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {t("L'agent prépare tout : visuels, posts, emails. Tu valides, c'est publié.")}
                </p>
              </div>

              <span className="relative mt-6 inline-flex items-center gap-1.5 self-start bg-white text-[#5B54D6] font-bold rounded-full px-6 py-2.5 transition-transform group-hover:translate-x-0.5">
                {t("Commencer")}
                <ArrowRight className="w-4 h-4" />
              </span>

              <span className="absolute bottom-4 right-4 z-10">
                <HelpTip text={t("L'agence automatique te pose 3 questions, choisit les réseaux et horaires, génère les visuels et le texte, puis publie sur Facebook et Instagram à ta validation.")} side="top" className="text-white/70 hover:text-white hover:bg-white/15" />
              </span>
            </button>

            {/* Cartes secondaires — colonne droite */}
            <div className="flex flex-col gap-4">
              {[
                {
                  title: t("Programmer un post"),
                  description: t("Choisis le réseau, la date, l'heure. On s'occupe du reste."),
                  icon: CalendarClock,
                  onClick: () => setToolboxOpen(true),
                  testId: "action-schedule-post",
                  help: t("Ouvre la boîte à outils pour programmer un post simple (texte + image) à une date et heure précises, sans passer par l'agence complète."),
                },
                {
                  title: t("Parler à l'agent"),
                  description: t("Pose une question marketing, demande une idée, brainstorme."),
                  icon: MessageCircle,
                  onClick: () => setLocation("/app/chat"),
                  testId: "action-open-chat",
                  help: t("Une conversation libre avec un stratège marketing senior. Idéal pour réfléchir, poser des questions précises ou faire valider une idée."),
                },
                {
                  title: t("Emails & contacts"),
                  description: t("Gère ta base d'abonnés et retrouve les stats de tes campagnes emailing."),
                  icon: Mail,
                  onClick: () => setLocation("/app/emails"),
                  testId: "action-emails",
                  help: t("Ajoute ou importe tes contacts, et consulte ouvertures et clics des campagnes que tu as envoyées depuis l'agence."),
                },
              ].map((a) => (
                <button
                  key={a.testId}
                  onClick={a.onClick}
                  data-testid={a.testId}
                  className="group relative text-left flex-1 p-6 rounded-2xl border border-card-border bg-card transition-all duration-200 hover:-translate-y-[2px] hover:border-[#5b54d6]/40 focus:outline-none focus:ring-2 focus:ring-[#5b54d6] focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-3 bg-[#5b54d6]/15">
                    <a.icon className="w-5 h-5 text-[#5b54d6]" />
                  </div>
                  <div className="font-bold text-[15px] text-foreground mb-1">{a.title}</div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{a.description}</p>
                  <ArrowRight className="absolute top-5 right-5 w-4 h-4 text-muted-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-foreground/80" />
                  <span className="absolute bottom-3 right-3 z-10">
                    <HelpTip text={a.help} side="top" />
                  </span>
                </button>
              ))}
            </div>

            {/* Mes campagnes — pleine largeur */}
            <button
              onClick={() => {
                const el = document.getElementById("recent-campaigns");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              data-testid="action-my-campaigns"
              className="group md:col-span-2 flex items-center gap-4 rounded-2xl border border-card-border bg-card px-6 sm:px-7 py-5 text-left transition-all duration-200 hover:border-[#5b54d6]/40 focus:outline-none focus:ring-2 focus:ring-[#5b54d6] focus:ring-offset-2 focus:ring-offset-background"
            >
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-[#5b54d6]/15">
                <ListChecks className="w-5 h-5 text-[#5b54d6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px] text-foreground">{t("Mes campagnes")}</div>
                <p className="text-[13px] text-muted-foreground">{t("Retrouve toutes tes campagnes et leurs résultats.")}</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                {t("Voir toutes")}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </section>

          {/* Branding — ce que GrowIQ fait pour ta marque */}
          <section className="mb-10 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-[#c026d3]/15 text-[#c026d3] flex items-center justify-center shrink-0">
                <Palette className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                {t("Ce que GrowIQ fait pour ta marque")}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 ml-[2.875rem]">
              {t("Le branding, c'est l'image que les gens gardent de ton entreprise. Voici ce que l'agent peut faire pour toi, en toute transparence.")}
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{t("Campagnes de notoriété (posts + email + pub)")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("L'agent crée et publie des posts, des emails et, si tu le souhaites, de la publicité pour te faire connaître auprès d'une nouvelle audience.")}
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{t("Cohérence de ton et de message sur tous les réseaux")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("À partir de ton profil (ton histoire, ton ton de communication), tout ce qui est publié parle d'une seule voix, reconnaissable.")}
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{t("Identité visuelle partielle (style cohérent, pas de charte figée)")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("Les visuels sont générés par l'IA dans un style soigné et cohérent, mais l'agent ne fige pas encore un logo et une palette de couleurs appliqués à l'identique partout.")}
                  </div>
                </div>
              </li>
            </ul>
            <button
              onClick={() => setLocation("/app/agency")}
              data-testid="branding-start-campaign"
              className="mt-5 inline-flex items-center gap-1.5 bg-[#c026d3] hover:bg-[#a81fb5] text-white rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#c026d3] focus:ring-offset-2"
            >
              <Palette className="w-4 h-4" />
              {t("Lancer une campagne de branding")}
            </button>
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
                className="relative overflow-hidden rounded-[14px] border border-card-border bg-card px-4 py-3 sm:px-5 sm:py-4"
              >
                <div className="text-[28px] sm:text-[32px] font-extrabold tracking-tight leading-none text-foreground">
                  {s.value}
                </div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider mt-1.5 text-muted-foreground">
                  {s.label}
                </div>
                <span aria-hidden className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(135deg, #5B54D6, #C026D3)" }} />
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
