import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Copy, ExternalLink, Users, Calendar, Target, Mail, RefreshCw, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LandingPage {
  id: number;
  slug: string;
  title: string;
  headline: string;
  createdAt: string;
}

interface Lead {
  id: number;
  email: string;
  name: string;
  data: Record<string, string>;
  createdAt: string;
}

interface ScheduledPost {
  id: number;
  title: string;
  content: string;
  platform: string;
  scheduledFor: string;
  status: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  meta?: {
    imageUrl?: string;
    metaPermalink?: string;
    metaPostId?: string;
  } | null;
}

interface ToolboxModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "landing" | "scheduled";

export function ToolboxModal({ open, onClose }: ToolboxModalProps) {
  const [tab, setTab] = useState<Tab>("landing");
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLeadsFor, setSelectedLeadsFor] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [lpRes, schedRes] = await Promise.all([
        fetch("/api/landing-pages"),
        fetch("/api/scheduled-posts"),
      ]);
      if (lpRes.ok) setLandingPages(await lpRes.json());
      if (schedRes.ok) setScheduled(await schedRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const loadLeads = async (pageId: number) => {
    setSelectedLeadsFor(pageId);
    const r = await fetch(`/api/landing-pages/${pageId}/leads`);
    if (r.ok) setLeads(await r.json());
  };

  const deleteLanding = async (id: number) => {
    if (!confirm("Supprimer cette page (les leads seront supprimés aussi) ?")) return;
    await fetch(`/api/landing-pages/${id}`, { method: "DELETE" });
    toast.success("Page supprimée");
    refresh();
    if (selectedLeadsFor === id) setSelectedLeadsFor(null);
  };

  const deleteScheduled = async (id: number) => {
    if (!confirm("Supprimer cette programmation ?")) return;
    await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
    toast.success("Programmation supprimée");
    refresh();
  };

  const publishMetaNow = async (p: ScheduledPost) => {
    if (p.platform !== "facebook" && p.platform !== "instagram") return;
    if (!confirm(`Publier vraiment maintenant sur ${p.platform === "facebook" ? "Facebook" : "Instagram"} ?`)) return;
    try {
      const r = await fetch("/api/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: p.platform,
          message: p.content,
          imageUrl: p.meta?.imageUrl,
          scheduledPostId: p.id,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Échec de la publication", {
          description: r.status === 412 ? "Token Meta manquant — configurez les secrets." : undefined,
        });
        return;
      }
      toast.success("Publication envoyée !", {
        action: data.permalink ? { label: "Voir", onClick: () => window.open(data.permalink, "_blank") } : undefined,
      });
      refresh();
    } catch {
      toast.error("Erreur réseau");
    }
  };

  const copyUrl = async (slug: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}landing/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("URL copiée");
  };

  const exportLeadsCsv = () => {
    if (leads.length === 0) return;
    const headers = ["email", "name", "createdAt"];
    const extra = new Set<string>();
    leads.forEach((l) => Object.keys(l.data).forEach((k) => extra.add(k)));
    extra.delete("email");
    extra.delete("name");
    const allHeaders = [...headers, ...Array.from(extra)];
    const rows = leads.map((l) =>
      allHeaders.map((h) => {
        const v = h === "email" ? l.email : h === "name" ? l.name : h === "createdAt" ? l.createdAt : (l.data[h] ?? "");
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [allHeaders.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (s: string) =>
    s === "sent" ? "text-green-600 bg-green-50 dark:bg-green-500/10"
    : s === "ready" ? "text-blue-600 bg-blue-50 dark:bg-blue-500/10"
    : s === "failed" ? "text-red-600 bg-red-50 dark:bg-red-500/10"
    : "text-amber-600 bg-amber-50 dark:bg-amber-500/10";

  const statusLabel = (s: string) =>
    s === "sent" ? "Envoyé" : s === "ready" ? "Prêt à publier" : s === "failed" ? "Échec" : "En attente";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🧰 Boîte à outils marketing
            <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto h-7 px-2">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b -mx-6 px-6 -mt-2">
          <button
            onClick={() => { setTab("landing"); setSelectedLeadsFor(null); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "landing" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            data-testid="tab-landing"
          >
            <Target className="w-3.5 h-3.5 inline mr-1.5" />
            Pages de capture ({landingPages.length})
          </button>
          <button
            onClick={() => setTab("scheduled")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "scheduled" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            data-testid="tab-scheduled"
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
            Posts programmés ({scheduled.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "landing" ? (
            selectedLeadsFor ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLeadsFor(null)}>← Retour</Button>
                  <span className="text-sm font-medium ml-auto">{leads.length} lead(s)</span>
                  <Button size="sm" variant="outline" onClick={exportLeadsCsv} disabled={leads.length === 0}>
                    📥 Export CSV
                  </Button>
                </div>
                {leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun lead pour le moment.</p>
                ) : (
                  <div className="space-y-1.5">
                    {leads.map((lead) => (
                      <div key={lead.id} className="flex items-start gap-3 p-2.5 rounded-md border bg-card text-sm">
                        <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.name || "Sans nom"}</div>
                          <div className="text-xs text-muted-foreground">{lead.email}</div>
                          {Object.keys(lead.data).filter((k) => !["name", "email"].includes(k)).map((k) => (
                            <div key={k} className="text-xs text-muted-foreground mt-0.5"><span className="font-medium">{k}:</span> {lead.data[k]}</div>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(lead.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : landingPages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune page de capture. Générez-en une depuis n'importe quelle campagne avec le bouton « Page de capture ».
              </p>
            ) : (
              <div className="space-y-2">
                {landingPages.map((p) => (
                  <div key={p.id} className="p-3 rounded-md border bg-card">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.headline}</div>
                        <code className="text-[10px] text-muted-foreground">/landing/{p.slug}</code>
                      </div>
                      <button onClick={() => deleteLanding(p.id)} className="text-muted-foreground hover:text-destructive p-1" data-testid={`del-lp-${p.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyUrl(p.slug)}>
                        <Copy className="w-3 h-3 mr-1" /> URL
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`${import.meta.env.BASE_URL}landing/${p.slug}`, "_blank")}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Ouvrir
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadLeads(p.id)} data-testid={`view-leads-${p.id}`}>
                        <Users className="w-3 h-3 mr-1" /> Leads
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun post programmé. Utilisez le bouton « Programmer » sous chaque campagne.
            </p>
          ) : (
            <div className="space-y-2">
              {scheduled.map((p) => (
                <div key={p.id} className="p-3 rounded-md border bg-card">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {p.platform === "email" ? <Mail className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                        <span>{p.platform}</span>
                        <span>•</span>
                        <span>{new Date(p.scheduledFor).toLocaleString("fr-FR")}</span>
                      </div>
                      {p.errorMessage && (
                        <div className="text-xs text-amber-600 mt-1">⚠️ {p.errorMessage}</div>
                      )}
                      {p.meta?.metaPermalink && (
                        <a
                          href={p.meta.metaPermalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Voir la publication
                        </a>
                      )}
                    </div>
                    <button onClick={() => deleteScheduled(p.id)} className="text-muted-foreground hover:text-destructive p-1" data-testid={`del-sched-${p.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {(p.platform === "facebook" || p.platform === "instagram") &&
                    p.status !== "sent" && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => publishMetaNow(p)}
                          data-testid={`publish-meta-${p.id}`}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Publier maintenant sur {p.platform === "facebook" ? "Facebook" : "Instagram"}
                        </Button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
