import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  useDeleteOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
  getListOpenaiMessagesQueryKey,
} from "@workspace/api-client-react";
import { Sidebar } from "@/components/sidebar";
import { ChatArea } from "@/components/chat-area";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const conversationId = params.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: isConversationsLoading } = useListOpenaiConversations({
    query: { queryKey: getListOpenaiConversationsQueryKey() },
  });

  const { data: conversationData, isLoading: isConversationLoading } = useGetOpenaiConversation(
    conversationId as number,
    {
      query: {
        enabled: !!conversationId,
        queryKey: getGetOpenaiConversationQueryKey(conversationId as number),
      },
    }
  );

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

  const handleNewConversation = useCallback(() => {
    setLocation("/");
  }, [setLocation]);

  const handleDeleteConversation = useCallback(
    (id: number) => {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
            if (conversationId === id) {
              setLocation("/");
            }
          },
          onError: () => {
            toast.error("Failed to delete conversation");
          },
        }
      );
    },
    [deleteMutation, queryClient, conversationId, setLocation]
  );

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
        const title = content.slice(0, 30) + (content.length > 30 ? "..." : "");
        const newConv = await createMutation.mutateAsync({ data: { title } });
        activeConvId = newConv.id;
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/conversations/${activeConvId}`);
      } catch (err) {
        toast.error("Failed to create conversation");
        return;
      }
    }

    if (!activeConvId) return;

    // Optimistically update UI
    const tempId = Date.now();
    const newUserMsg = {
      id: tempId,
      conversationId: activeConvId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData(getListOpenaiMessagesQueryKey(activeConvId), (old: any) => {
      return old ? [...old, newUserMsg] : [newUserMsg];
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
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantText += data.content;
                  setStreamingContent(assistantText);
                }
              } catch (e) {}
            }
          }
        }
      }
      
      setIsStreaming(false);
      setStreamingContent("");
      
      // Invalidate to fetch the final messages including the newly saved ones
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(activeConvId) });
    } catch (err) {
      toast.error("Error sending message");
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        conversations={conversations || []}
        activeId={conversationId}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        isLoading={isConversationsLoading}
      />
      <div className="flex flex-1 flex-col relative h-full">
        {(!conversationId && !createMutation.isPending) ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="bg-primary/10 p-4 rounded-full mb-6 text-primary">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Marketing Agent IA
            </h2>
            <p className="text-muted-foreground max-w-md">
              Your senior marketing strategist. Ask about campaigns, digital strategy, SEO, or influencer outreach.
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
    <form onSubmit={handleSubmit} className="relative shadow-sm rounded-xl border border-input bg-card flex items-end p-2 focus-within:ring-1 focus-within:ring-primary">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="Ask about marketing strategy..."
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </div>
    </form>
  );
}
