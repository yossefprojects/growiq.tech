import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  useDeleteOpenaiConversation,
  useListOpenaiMessages,
  useListOpenaiCampaigns,
  useDeleteOpenaiCampaign,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
  getListOpenaiMessagesQueryKey,
  getListOpenaiCampaignsQueryKey,
} from "@workspace/api-client-react";
import { Sidebar } from "@/components/sidebar";
import { ChatArea } from "@/components/chat-area";
import { CampaignLaunchModal } from "@/components/campaign-launch-modal";
import { WelcomeTour, shouldShowWelcomeTour } from "@/components/welcome-tour";
import { toast } from "sonner";
import { Rocket, MessageSquarePlus } from "lucide-react";

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const conversationId = params.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!shouldShowWelcomeTour()) return;
    const t = setTimeout(() => setShowWelcome(true), 400);
    return () => clearTimeout(t);
  }, []);

  const { data: conversations, isLoading: isConversationsLoading } = useListOpenaiConversations({
    query: { queryKey: getListOpenaiConversationsQueryKey() },
  });

  const { data: campaignsData, isLoading: isCampaignsLoading } = useListOpenaiCampaigns({
    query: { queryKey: getListOpenaiCampaignsQueryKey() },
  });

  const { data: conversationData } = useGetOpenaiConversation(conversationId as number, {
    query: {
      enabled: !!conversationId,
      queryKey: getGetOpenaiConversationQueryKey(conversationId as number),
    },
  });

  const { data: messagesData, isLoading: isMessagesLoading } = useListOpenaiMessages(
    conversationId as number,
    {
      query: {
        enabled: !!conversationId,
        queryKey: getListOpenaiMessagesQueryKey(conversationId as number),
      },
    }
  );

  const createMutation = useCreateOpenaiConversation();
  const deleteMutation = useDeleteOpenaiConversation();
  const deleteCampaignMutation = useDeleteOpenaiCampaign();

  const handleNewConversation = useCallback(() => {
    setLocation("/app");
  }, [setLocation]);

  const handleDeleteConversation = useCallback(
    (id: number) => {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
            if (conversationId === id) setLocation("/app");
          },
          onError: () => toast.error("Impossible de supprimer la conversation"),
        }
      );
    },
    [deleteMutation, queryClient, conversationId, setLocation]
  );

  const handleDeleteCampaign = useCallback(
    (id: number) => {
      deleteCampaignMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOpenaiCampaignsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          },
          onError: () => toast.error("Impossible de supprimer la campagne"),
        }
      );
    },
    [deleteCampaignMutation, queryClient]
  );

  const handleCampaignCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListOpenaiCampaignsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
  }, [queryClient]);

  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData, streamingContent]);

  const handleSendMessage = async (content: string) => {
    let activeConvId = conversationId;

    if (!activeConvId) {
      try {
        const title = content.slice(0, 40) + (content.length > 40 ? "…" : "");
        const newConv = await createMutation.mutateAsync({ data: { title } });
        activeConvId = newConv.id;
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/app/conversations/${activeConvId}`);
      } catch {
        toast.error("Impossible de créer la conversation");
        return;
      }
    }

    if (!activeConvId) return;

    const tempId = Date.now();
    const newUserMsg = {
      id: tempId,
      conversationId: activeConvId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData(getListOpenaiMessagesQueryKey(activeConvId), (old: unknown) => {
      const arr = Array.isArray(old) ? old : [];
      return [...arr, newUserMsg];
    });

    try {
      setIsStreaming(true);
      setStreamingContent("");

      const response = await fetch(`/api/openai/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantText += data.content;
                  setStreamingContent(assistantText);
                }
              } catch (_) {}
            }
          }
        }
      }

      setIsStreaming(false);
      setStreamingContent("");
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(activeConvId) });
    } catch {
      toast.error("Erreur lors de l'envoi du message");
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const isLoading = isConversationsLoading || isCampaignsLoading;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        conversations={conversations || []}
        campaigns={campaignsData || []}
        activeId={conversationId}
        onNew={handleNewConversation}
        onLaunchCampaign={() => setShowCampaignModal(true)}
        onDelete={handleDeleteConversation}
        onDeleteCampaign={handleDeleteCampaign}
        onShowDemo={() => setShowWelcome(true)}
        isLoading={isLoading}
      />

      <div className="flex flex-1 flex-col relative h-full">
        {!conversationId && !createMutation.isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="bg-primary/10 p-4 rounded-full mb-6 text-primary">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Marketing Agent IA
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Votre stratège marketing senior. Posez une question ou laissez l'agent créer une campagne complète pour vous.
            </p>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3 text-sm font-semibold transition-colors shadow-md"
              data-testid="button-launch-campaign-hero"
            >
              <Rocket className="w-4 h-4" />
              Lancer une campagne gratuite
            </button>
            <p className="text-xs text-muted-foreground mt-4">
              7 types de campagnes · Livrables complets · Prêts à l'emploi
            </p>
          </div>
        ) : (
          <ChatArea
            messages={messagesData || []}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            isLoading={isMessagesLoading}
            scrollRef={scrollRef}
          />
        )}

        <div className="p-4 w-full max-w-4xl mx-auto absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-10">
          <ChatInput onSend={handleSendMessage} disabled={isStreaming || createMutation.isPending} />
        </div>
      </div>

      <CampaignLaunchModal
        open={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        onCampaignCreated={handleCampaignCreated}
      />

      <WelcomeTour open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
}

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative shadow-sm rounded-xl border border-input bg-card flex items-end p-2 focus-within:ring-1 focus-within:ring-primary"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="Posez votre question marketing…"
        className="w-full max-h-40 min-h-[44px] resize-none bg-transparent px-3 py-3 text-sm focus:outline-none disabled:opacity-50 text-foreground placeholder:text-muted-foreground"
        disabled={disabled}
        data-testid="input-chat"
        rows={1}
      />
      <div className="px-2 pb-2">
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 w-8 rounded-md flex items-center justify-center disabled:opacity-50 transition-colors"
          data-testid="button-send"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </form>
  );
}
