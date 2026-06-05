import { useState } from "react";
import { Link } from "wouter";
import { Trash2, MessageSquare, Plus, Loader2, Rocket, Wrench, PlayCircle, Sparkles, Plug, Search, Shield, User as UserIcon, LogOut } from "lucide-react";
import { useAuth, useUser, SignOutButton } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CAMPAIGN_TYPES } from "./campaign-launch-modal";
import { ToolboxModal } from "./toolbox-modal";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { useT } from "@/lib/i18n";
import { BrandLogo } from "./brand-logo";
import { AdminIconButton } from "./admin-button";

const sidebarBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AccountLink() {
  const { user } = useUser();
  const t = useT();
  const initial = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase();
  const label = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? t("Mon compte");
  return (
    <Link
      href="/app/account"
      className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md px-2 py-1.5 transition-colors"
      data-testid="link-account"
    >
      {user?.imageUrl ? (
        <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-[#ff7a3c] text-white flex items-center justify-center text-xs font-bold shrink-0">
          {initial}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-foreground truncate">{t("Mon compte")}</span>
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
      </div>
      <UserIcon className="w-4 h-4 ml-auto shrink-0" />
    </Link>
  );
}

// Same queryKey shape as AdminGate in App.tsx to share the React Query cache.
type SidebarMeState =
  | { kind: "ok"; data: { userId: string; email: string | null; isAdmin: boolean } }
  | { kind: "unauthenticated" }
  | { kind: "network_error" };

function AdminLink() {
  const { getToken } = useAuth();
  const t = useT();
  const { data } = useQuery<SidebarMeState>({
    queryKey: ["me"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${sidebarBasePath}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) return { kind: "unauthenticated" };
      if (!res.ok) return { kind: "network_error" };
      return { kind: "ok", data: await res.json() };
    },
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = data?.kind === "ok" && data.data.isAdmin;
  if (!isAdmin) return null;
  return (
    <Link
      href="/app/admin"
      className="flex items-center gap-2 text-sm font-semibold text-[#5b54d6] hover:bg-[#5b54d6]/10 rounded-md px-2 py-1.5 transition-colors border border-[#5b54d6]/30"
      data-testid="link-admin"
    >
      <Shield className="w-4 h-4" />
      <span>{t("Admin CRM")}</span>
    </Link>
  );
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Campaign {
  id: number;
  title: string;
  type: string;
  conversationId?: number | null;
  createdAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  campaigns: Campaign[];
  activeId: number | null;
  onNew: () => void;
  onLaunchCampaign: () => void;
  onDelete: (id: number) => void;
  onDeleteCampaign: (id: number) => void;
  onShowDemo?: () => void;
  isLoading: boolean;
}

export function Sidebar({
  conversations = [],
  campaigns = [],
  activeId,
  onNew,
  onLaunchCampaign,
  onDelete,
  onDeleteCampaign,
  onShowDemo,
  isLoading,
}: SidebarProps) {
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const t = useT();
  return (
    <div className="w-64 border-r bg-card flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-4 border-b bg-gradient-to-br from-primary/15 to-fuchsia-500/10 flex items-center justify-between gap-2">
        <Link href="/" className="group transition-transform group-hover:scale-105" data-testid="link-home-sidebar">
          <BrandLogo iconSize={36} wordmarkClassName="text-xl" />
        </Link>
        <AdminIconButton variant="ghost" />
      </div>
      <div className="p-3 border-b flex flex-col gap-2">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md h-9 px-4 text-sm font-medium transition-colors shadow-sm"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4" />
          {t("Nouveau chat")}
        </button>
        <button
          onClick={onLaunchCampaign}
          className="w-full flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-md h-9 px-4 text-sm font-medium transition-colors"
          data-testid="button-launch-campaign"
        >
          <Rocket className="w-4 h-4" />
          {t("Lancer une campagne")}
        </button>
        <Link
          href="/app/agency"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:opacity-90 rounded-md h-9 px-4 text-sm font-medium transition-opacity shadow-sm"
          data-testid="link-agency"
        >
          <Sparkles className="w-4 h-4" />
          {t("Agence automatique")}
        </Link>
        <button
          onClick={() => setToolboxOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/70 hover:text-foreground rounded-md h-8 px-4 text-xs font-medium transition-colors"
          data-testid="button-toolbox"
        >
          <Wrench className="w-3.5 h-3.5" />
          {t("Boîte à outils")}
        </button>
        {onShowDemo && (
          <button
            onClick={onShowDemo}
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/70 hover:text-foreground rounded-md h-8 px-4 text-xs font-medium transition-colors"
            data-testid="button-show-demo"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            {t("Voir la démo")}
          </button>
        )}
      </div>
      <ToolboxModal open={toolboxOpen} onClose={() => setToolboxOpen(false)} />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {campaigns.length > 0 && (
              <div className="p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  {t("Campagnes")}
                </p>
                <div className="flex flex-col gap-1">
                  {campaigns.map((campaign) => {
                    const typeInfo = CAMPAIGN_TYPES.find((t) => t.id === campaign.type);
                    const href = campaign.conversationId
                      ? `/app/conversations/${campaign.conversationId}`
                      : "/app/chat";
                    return (
                      <div
                        key={campaign.id}
                        className={cn(
                          "group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                          campaign.conversationId && activeId === campaign.conversationId
                            ? "bg-secondary text-secondary-foreground font-medium"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                        data-testid={`link-campaign-${campaign.id}`}
                      >
                        <Link href={href} className="flex-1 truncate flex items-center gap-2">
                          <span className="text-base flex-shrink-0">{typeInfo?.icon ?? "📋"}</span>
                          <span className="truncate text-xs">{campaign.title}</span>
                        </Link>
                        <button
                          onClick={() => onDeleteCampaign(campaign.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                          data-testid={`button-delete-campaign-${campaign.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {conversations.length > 0 && (
              <div className="p-3">
                {campaigns.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                    {t("Conversations")}
                  </p>
                )}
                <div className="flex flex-col gap-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                        activeId === conv.id
                          ? "bg-secondary text-secondary-foreground font-medium"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                      data-testid={`link-conversation-${conv.id}`}
                    >
                      <Link href={`/app/conversations/${conv.id}`} className="flex-1 truncate flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </Link>
                      <button
                        onClick={() => onDelete(conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                        data-testid={`button-delete-${conv.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {campaigns.length === 0 && conversations.length === 0 && (
              <div className="p-6 text-center">
                <Rocket className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("Lancez votre première campagne ou démarrez un chat.")}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t p-3 flex flex-col gap-2">
        <Link
          href="/app/seo"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md px-2 py-1.5 transition-colors"
          data-testid="link-seo"
        >
          <Search className="w-4 h-4" />
          <span>SEO</span>
        </Link>
        <Link
          href="/app/integrations"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md px-2 py-1.5 transition-colors"
          data-testid="link-integrations"
        >
          <Plug className="w-4 h-4" />
          <span>{t("Mes outils")}</span>
        </Link>
        <AdminLink />

        <LanguageSwitcher className="px-2 py-1.5" />

        <ThemeToggle variant="row" testId="theme-toggle-sidebar" />

        <AccountLink />
        <SignOutButton redirectUrl="/">
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md px-2 py-1.5 transition-colors w-full"
            data-testid="button-signout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t("Se déconnecter")}</span>
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
