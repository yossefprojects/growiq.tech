import { Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
  scrollRef: React.RefObject<HTMLDivElement>;
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
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  );
}
