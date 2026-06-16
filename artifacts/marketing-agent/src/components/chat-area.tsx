import { useState } from "react";
import { Loader2, Bot, User, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CampaignActions } from "@/components/campaign-actions";

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  isLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatArea({ messages, isStreaming, streamingContent, isLoading, scrollRef }: ChatAreaProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 pb-28 sm:pb-36 space-y-4 sm:space-y-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <MessageItem
            message={{
              id: 0,
              role: "assistant",
              content: streamingContent || "...",
              createdAt: new Date().toISOString(),
            }}
            isStreaming
          />
        )}
      </div>
    </div>
  );
}

function MessageItem({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === "user";
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = !isUser && !isStreaming && message.content.length > 200;
  const preview = message.content.replace(/[#*`>_~\-]/g, "").trim().slice(0, 90);

  return (
    <div
      className={cn(
        "flex gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-xl max-w-[95%] sm:max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "bg-primary/5 ml-auto border border-primary/10" : "bg-card border border-border shadow-sm"
      )}
      data-testid={`message-${message.role}`}
    >
      <div className={cn(
        "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white",
        isUser ? "bg-primary" : "bg-foreground"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
          <span>{isUser ? "Toi" : "GrowIQ"}</span>
          {isStreaming && <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />}
          {canCollapse && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-0.5 hover:bg-secondary"
              data-testid="button-toggle-collapse"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Afficher la réponse complète" : "Réduire la réponse"}
              title={collapsed ? "Afficher la réponse" : "Réduire la réponse"}
            >
              {collapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Afficher
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Réduire
                </>
              )}
            </button>
          )}
        </div>
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="text-left w-full text-sm text-muted-foreground italic hover:text-foreground transition-colors"
            data-testid="collapsed-preview"
          >
            {preview}… <span className="not-italic text-primary">cliquer pour développer</span>
          </button>
        ) : (
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-foreground/90 break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mt-4 mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-foreground">{children}</h4>,
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-secondary p-3 rounded-md overflow-x-auto my-2 text-xs font-mono">{children}</pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/40 pl-3 my-2 italic text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                img: ({ src, alt }) => (
                  <img src={src} alt={alt || ""} className="rounded-lg w-full max-w-md my-3" loading="lazy" />
                ),
                hr: () => <hr className="my-3 border-border" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full text-xs border border-border rounded">{children}</table>
                  </div>
                ),
                th: ({ children }) => <th className="border border-border px-2 py-1 bg-secondary text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        )}
        {!isUser && !isStreaming && !collapsed && message.content.length > 300 && (
          <CampaignActions content={message.content} title="Campagne marketing" />
        )}
        {canCollapse && !collapsed && (
          <div className="pt-2 mt-2 border-t border-border flex justify-end">
            <button
              onClick={() => setCollapsed(true)}
              className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-secondary"
              data-testid="button-toggle-collapse-bottom"
              aria-label="Réduire la réponse"
              title="Réduire la réponse"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Réduire
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
