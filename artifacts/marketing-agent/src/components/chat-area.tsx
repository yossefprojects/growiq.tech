import { Loader2, Bot, User } from "lucide-react";
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-36 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
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

  return (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-xl max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "bg-primary/5 ml-auto border border-primary/10" : "bg-card border border-border shadow-sm"
      )}
      data-testid={`message-${message.role}`}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white",
        isUser ? "bg-primary" : "bg-foreground"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
          {isUser ? "You" : "Marketing Agent IA"}
          {isStreaming && <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />}
        </div>
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
        {!isUser && !isStreaming && message.content.length > 300 && (
          <CampaignActions content={message.content} title="Campagne marketing" />
        )}
      </div>
    </div>
  );
}
