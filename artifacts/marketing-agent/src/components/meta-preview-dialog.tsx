import { useEffect, useState } from "react";
import { Loader2, Send, X, ThumbsUp, MessageCircle, Share2, Heart, Bookmark } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface MetaPreviewPost {
  id: number;
  title: string;
  content: string;
  platform: "facebook" | "instagram";
  imageUrl?: string;
}

interface Profile {
  name: string;
  pictureUrl: string;
}

interface MetaPreviewDialogProps {
  open: boolean;
  post: MetaPreviewPost | null;
  onClose: () => void;
  onConfirm: (post: MetaPreviewPost) => Promise<void>;
}

export function MetaPreviewDialog({ open, post, onClose, onConfirm }: MetaPreviewDialogProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open || !post) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoadingProfile(true);
    fetch(`/api/meta/profile?platform=${post.platform}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, post]);

  if (!post) return null;

  const isInstagram = post.platform === "instagram";
  const displayName = profile?.name ?? (isInstagram ? "@votre_compte" : "Votre Page");
  const now = new Date().toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleConfirm = async () => {
    setPublishing(true);
    try {
      await onConfirm(post);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !publishing && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-base">
            Aperçu — {isInstagram ? "Instagram" : "Facebook"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Voici à quoi ressemblera votre publication. Vérifiez avant de publier.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto bg-muted/30 p-4">
          {isInstagram ? (
            <InstagramPostMock
              displayName={displayName}
              profilePic={profile?.pictureUrl}
              content={post.content}
              imageUrl={post.imageUrl}
              loadingProfile={loadingProfile}
            />
          ) : (
            <FacebookPostMock
              displayName={displayName}
              profilePic={profile?.pictureUrl}
              content={post.content}
              imageUrl={post.imageUrl}
              date={now}
              loadingProfile={loadingProfile}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-background">
          <Button variant="outline" onClick={onClose} disabled={publishing} data-testid="meta-preview-cancel">
            <X className="w-4 h-4 mr-1.5" />
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={publishing} data-testid="meta-preview-publish">
            {publishing ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-1.5" />
            )}
            Publier maintenant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ url, fallback, loading }: { url?: string; fallback: string; loading: boolean }) {
  if (loading) {
    return <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />;
  }
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
      {fallback.charAt(0).toUpperCase()}
    </div>
  );
}

function FacebookPostMock({
  displayName,
  profilePic,
  content,
  imageUrl,
  date,
  loadingProfile,
}: {
  displayName: string;
  profilePic?: string;
  content: string;
  imageUrl?: string;
  date: string;
  loadingProfile: boolean;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 font-sans">
      <div className="flex items-start gap-2.5 p-3">
        <Avatar url={profilePic} fallback={displayName} loading={loadingProfile} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{displayName}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{date} · 🌐</div>
        </div>
      </div>
      <div className="px-3 pb-3 text-[15px] leading-snug text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words">
        {content}
      </div>
      {imageUrl && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <img src={imageUrl} alt="" className="w-full max-h-[400px] object-cover" />
        </div>
      )}
      <div className="flex items-center justify-around border-t border-zinc-200 dark:border-zinc-800 px-2 py-1 text-zinc-600 dark:text-zinc-400 text-sm">
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-1 justify-center" disabled>
          <ThumbsUp className="w-4 h-4" /> J'aime
        </button>
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-1 justify-center" disabled>
          <MessageCircle className="w-4 h-4" /> Commenter
        </button>
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-1 justify-center" disabled>
          <Share2 className="w-4 h-4" /> Partager
        </button>
      </div>
    </div>
  );
}

function InstagramPostMock({
  displayName,
  profilePic,
  content,
  imageUrl,
  loadingProfile,
}: {
  displayName: string;
  profilePic?: string;
  content: string;
  imageUrl?: string;
  loadingProfile: boolean;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 font-sans overflow-hidden">
      <div className="flex items-center gap-2.5 p-3">
        <Avatar url={profilePic} fallback={displayName.replace("@", "")} loading={loadingProfile} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{displayName}</div>
        </div>
        <div className="text-zinc-500">⋯</div>
      </div>
      {imageUrl ? (
        <div className="bg-black">
          <img src={imageUrl} alt="" className="w-full aspect-square object-cover" />
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 dark:from-pink-950/30 dark:via-purple-950/30 dark:to-blue-950/30 flex items-center justify-center text-zinc-500 text-sm px-6 text-center">
          Instagram exige une image — celle-ci sera obligatoire pour publier.
        </div>
      )}
      <div className="flex items-center gap-3 px-3 pt-3 text-zinc-900 dark:text-zinc-100">
        <Heart className="w-6 h-6" />
        <MessageCircle className="w-6 h-6" />
        <Share2 className="w-6 h-6" />
        <Bookmark className="w-6 h-6 ml-auto" />
      </div>
      <div className="px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
        <span className="font-semibold mr-1.5">{displayName}</span>
        <span className="whitespace-pre-wrap break-words">{content}</span>
      </div>
    </div>
  );
}
