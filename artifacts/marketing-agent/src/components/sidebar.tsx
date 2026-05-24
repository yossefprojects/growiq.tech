import { useState } from "react";
import { Link } from "wouter";
import { Trash2, MessageSquare, Plus, Loader2, Rocket, Wrench, PlayCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMPAIGN_TYPES } from "./campaign-launch-modal";
import { ToolboxModal } from "./toolbox-modal";

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
  return (
    <div className="w-64 border-r bg-card flex flex-col h-full flex-shrink-0">
      <div className="p-3 border-b flex items-center justify-center">
        <Link href="/" className="flex items-center gap-2 group" data-testid="link-home-sidebar">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">GrowIQ</span>
        </Link>
      </div>
      <div className="p-3 border-b flex flex-col gap-2">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md h-9 px-4 text-sm font-medium transition-colors shadow-sm"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4" />
          Nouveau chat
        </button>
        <button
          onClick={onLaunchCampaign}
          className="w-full flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-md h-9 px-4 text-sm font-medium transition-colors"
          data-testid="button-launch-campaign"
        >
          <Rocket className="w-4 h-4" />
          Lancer une campagne
        </button>
        <Link
          href="/app/agency"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:opacity-90 rounded-md h-9 px-4 text-sm font-medium transition-opacity shadow-sm"
          data-testid="link-agency"
        >
          <Sparkles className="w-4 h-4" />
          Agence automatique
        </Link>
        <button
          onClick={() => setToolboxOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/70 hover:text-foreground rounded-md h-8 px-4 text-xs font-medium transition-colors"
          data-testid="button-toolbox"
        >
          <Wrench className="w-3.5 h-3.5" />
          Boîte à outils
        </button>
        {onShowDemo && (
          <button
            onClick={onShowDemo}
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/70 hover:text-foreground rounded-md h-8 px-4 text-xs font-medium transition-colors"
            data-testid="button-show-demo"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Voir la démo
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
                  Campagnes
                </p>
                <div className="flex flex-col gap-1">
                  {campaigns.map((campaign) => {
                    const typeInfo = CAMPAIGN_TYPES.find((t) => t.id === campaign.type);
                    const href = campaign.conversationId
                      ? `/app/conversations/${campaign.conversationId}`
                      : "/app";
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
                    Conversations
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
                  Lancez votre première campagne ou démarrez un chat.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
