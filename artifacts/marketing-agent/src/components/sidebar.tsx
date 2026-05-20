import { Link } from "wouter";
import { Trash2, MessageSquare, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  onNew: () => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}

export function Sidebar({ conversations, activeId, onNew, onDelete, isLoading }: SidebarProps) {
  return (
    <div className="w-64 border-r bg-card flex flex-col h-full flex-shrink-0">
      <div className="p-4 border-b">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md h-10 px-4 text-sm font-medium transition-colors shadow-sm"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center p-4">No conversations yet</p>
        ) : (
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
                <Link href={`/conversations/${conv.id}`} className="flex-1 truncate flex items-center gap-2">
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
        )}
      </div>
    </div>
  );
}
