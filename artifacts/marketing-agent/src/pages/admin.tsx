import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Users,
  Loader2,
  Search,
  Shield,
  ChevronRight,
  Mail,
  Calendar,
  Briefcase,
  MessageSquare,
  Sparkles,
  Send,
  Layout,
  UserPlus,
  Megaphone,
  Target,
  KeyRound,
  CalendarRange,
  Building2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Counters = {
  conversations: number;
  messages: number;
  agencyCampaigns: number;
  scheduledPosts: number;
  landingPages: number;
  leads: number;
  adCampaigns: number;
  seoAudits: number;
  seoKeywordSets: number;
  seoContentPlans: number;
};

type UserRow = {
  id: string;
  email: string | null;
  isAdmin: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  hasBusinessProfile: boolean;
  counters: Counters;
};

type UsersResponse = { users: UserRow[]; totals: Record<string, number> };

type UserDetail = {
  user: { id: string; email: string | null; isAdmin: boolean; firstSeenAt: string; lastSeenAt: string };
  businessProfile: {
    businessName: string | null;
    activity: string | null;
    targetAudience: string | null;
    tone: string | null;
    primaryGoal: string | null;
    updatedAt: string;
  } | null;
  conversations: { id: number; title: string; createdAt: string }[];
  agencyCampaigns: {
    id: number; name: string; status: string;
    brief: { product?: string; audience?: string; objective?: string } | null;
    postsCount: number; launchedAt: string | null; createdAt: string;
  }[];
  scheduledPosts: {
    id: number; title: string; platform: string; status: string;
    scheduledFor: string; sentAt: string | null; errorMessage: string | null;
  }[];
  landingPages: { id: number; slug: string; title: string; active: boolean; createdAt: string }[];
  leads: { id: number; email: string; name: string; landingPageId: number; createdAt: string }[];
  adCampaigns: { id: number; provider: string; status: string; budgetCents: number; currency: string; createdAt: string }[];
  seoAudits: { id: number; url: string; score: number; createdAt: string }[];
  seoKeywordSets: { id: number; topic: string; keywordCount: number; createdAt: string }[];
  seoContentPlans: { id: number; title: string; horizonDays: number; itemCount: number; createdAt: string }[];
};

function useAuthedFetch() {
  const { getToken } = useAuth();
  return async (path: string) => {
    const token = await getToken();
    const res = await fetch(`${basePath}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.text();
      let msg = `HTTP ${res.status}`;
      try { const j = JSON.parse(body) as { error?: string }; if (j.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

function totalProjects(c: Counters): number {
  return (
    c.conversations + c.agencyCampaigns + c.scheduledPosts + c.landingPages +
    c.adCampaigns + c.seoAudits + c.seoKeywordSets + c.seoContentPlans
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center gap-3">
      <Icon className="w-5 h-5 text-[#5b54d6] shrink-0" />
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ── User detail panel ─────────────────────────────────────────────────────

function UserDetailPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const af = useAuthedFetch();
  const { data, isLoading, error } = useQuery<UserDetail>({
    queryKey: ["admin-user", userId],
    queryFn: () => af(`/api/admin/users/${userId}`) as Promise<UserDetail>,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end" onClick={onClose}>
      <div
        className="w-full max-w-3xl h-full bg-background overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border/60 px-5 py-3 flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-lg">{data?.user.email ?? "Utilisateur"}</h2>
            <p className="text-xs text-muted-foreground font-mono">{userId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-md" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#5b54d6]" /></div>
        ) : error || !data ? (
          <div className="p-6 text-sm text-red-600">Échec du chargement du détail.</div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Account */}
            <Section title="Compte" icon={Shield}>
              <KV k="Email" v={data.user.email ?? "—"} />
              <KV k="Identifiant Clerk" v={<span className="font-mono text-xs">{data.user.id}</span>} />
              <KV k="Statut" v={data.user.isAdmin ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#5b54d6]/15 text-[#5b54d6] px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              ) : "Utilisateur"} />
              <KV k="Première connexion" v={fmtDate(data.user.firstSeenAt)} />
              <KV k="Dernière activité" v={fmtDate(data.user.lastSeenAt)} />
            </Section>

            {/* Business profile */}
            <Section title="Profil business" icon={Building2}>
              {!data.businessProfile ? (
                <p className="text-sm text-muted-foreground">Aucun profil rempli.</p>
              ) : (
                <>
                  <KV k="Nom" v={data.businessProfile.businessName ?? "—"} />
                  <KV k="Activité" v={data.businessProfile.activity ?? "—"} />
                  <KV k="Cible" v={data.businessProfile.targetAudience ?? "—"} />
                  <KV k="Ton" v={data.businessProfile.tone ?? "—"} />
                  <KV k="Objectif" v={data.businessProfile.primaryGoal ?? "—"} />
                  <KV k="Mis à jour" v={fmtDate(data.businessProfile.updatedAt)} />
                </>
              )}
            </Section>

            {/* Agency campaigns */}
            <ListSection
              title="Campagnes agence"
              icon={Sparkles}
              items={data.agencyCampaigns}
              empty="Aucune campagne agence."
              render={(c) => (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{c.name}</div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.postsCount} posts · créée le {fmtDateShort(c.createdAt)}
                    {c.launchedAt && ` · lancée le ${fmtDateShort(c.launchedAt)}`}
                  </div>
                  {c.brief?.objective && (
                    <div className="text-xs text-muted-foreground/80 mt-1">Objectif : {c.brief.objective}</div>
                  )}
                </div>
              )}
            />

            {/* Scheduled posts */}
            <ListSection
              title="Posts programmés"
              icon={Send}
              items={data.scheduledPosts}
              empty="Aucun post programmé."
              render={(p) => (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{p.title}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.platform} · prévu {fmtDate(p.scheduledFor)}
                    {p.sentAt && ` · envoyé ${fmtDate(p.sentAt)}`}
                  </div>
                  {p.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">Erreur : {p.errorMessage}</div>
                  )}
                </div>
              )}
            />

            {/* Landing pages */}
            <ListSection
              title="Landing pages"
              icon={Layout}
              items={data.landingPages}
              empty="Aucune landing page."
              render={(l) => (
                <div>
                  <div className="font-medium truncate">{l.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    /{l.slug} · {l.active ? "active" : "inactive"} · {fmtDateShort(l.createdAt)}
                  </div>
                </div>
              )}
            />

            {/* Leads */}
            <ListSection
              title="Leads collectés"
              icon={UserPlus}
              items={data.leads}
              empty="Aucun lead."
              render={(l) => (
                <div>
                  <div className="font-medium truncate">{l.name || l.email}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {l.email} · landing #{l.landingPageId} · {fmtDateShort(l.createdAt)}
                  </div>
                </div>
              )}
            />

            {/* Ad campaigns */}
            <ListSection
              title="Campagnes payantes"
              icon={Megaphone}
              items={data.adCampaigns}
              empty="Aucune campagne payante."
              render={(a) => (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{a.provider}</div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Budget : {(a.budgetCents / 100).toFixed(2)} {a.currency} · {fmtDateShort(a.createdAt)}
                  </div>
                </div>
              )}
            />

            {/* Conversations */}
            <ListSection
              title="Conversations chat"
              icon={MessageSquare}
              items={data.conversations}
              empty="Aucune conversation."
              render={(c) => (
                <div>
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(c.createdAt)}</div>
                </div>
              )}
            />

            {/* SEO */}
            <ListSection
              title="Audits SEO"
              icon={Target}
              items={data.seoAudits}
              empty="Aucun audit SEO."
              render={(a) => (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate text-sm">{a.url}</div>
                    <span className="text-xs font-bold">{a.score}/100</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(a.createdAt)}</div>
                </div>
              )}
            />
            <ListSection
              title="Recherches mots-clés SEO"
              icon={KeyRound}
              items={data.seoKeywordSets}
              empty="Aucune recherche."
              render={(k) => (
                <div>
                  <div className="font-medium truncate">{k.topic}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {k.keywordCount} mots-clés · {fmtDateShort(k.createdAt)}
                  </div>
                </div>
              )}
            />
            <ListSection
              title="Plans éditoriaux SEO"
              icon={CalendarRange}
              items={data.seoContentPlans}
              empty="Aucun plan éditorial."
              render={(p) => (
                <div>
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.horizonDays} jours · {p.itemCount} contenus · {fmtDateShort(p.createdAt)}
                  </div>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#5b54d6]" />
        <h3 className="font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ListSection<T>({
  title, icon, items, empty, render,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: T[];
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <Section title={`${title} (${items.length})`} icon={icon}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-md border border-border/40 p-2.5 text-sm">
              {render(it)}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-muted-foreground text-xs uppercase tracking-wider w-32 shrink-0">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-amber-500/100/15 text-amber-300",
    scheduled: "bg-blue-500/100/15 text-blue-300",
    sent: "bg-[#3dbf8e]/15 text-[#1a7a55]",
    launched: "bg-[#3dbf8e]/15 text-[#1a7a55]",
    active: "bg-[#3dbf8e]/15 text-[#1a7a55]",
    paused: "bg-amber-500/100/15 text-amber-300",
    failed: "bg-red-500/100/15 text-red-300",
    error: "bg-red-500/100/15 text-red-300",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold shrink-0", cls)}>{status}</span>;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const af = useAuthedFetch();
  const [search, setSearch] = useState("");
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ["admin-users"],
    queryFn: () => af("/api/admin/users") as Promise<UsersResponse>,
  });

  const filtered = (data?.users ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.email ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-7 h-7 text-[#5b54d6]" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">Admin CRM</h1>
        </div>
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          Toutes les inscriptions et leurs projets. Vue lecture seule.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#5b54d6]" /></div>
        ) : error || !data ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Échec du chargement.
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
              <Stat icon={Users} label="Utilisateurs" value={data.totals.users ?? 0} />
              <Stat icon={Building2} label="Profils business" value={data.totals.profiles ?? 0} />
              <Stat icon={Sparkles} label="Campagnes agence" value={data.totals.agencyCampaigns ?? 0} />
              <Stat icon={Send} label="Posts programmés" value={data.totals.scheduledPosts ?? 0} />
              <Stat icon={Layout} label="Landing pages" value={data.totals.landingPages ?? 0} />
              <Stat icon={UserPlus} label="Leads collectés" value={data.totals.leads ?? 0} />
              <Stat icon={Megaphone} label="Campagnes payantes" value={data.totals.adCampaigns ?? 0} />
              <Stat icon={Target} label="Audits SEO" value={data.totals.seoAudits ?? 0} />
              <Stat icon={KeyRound} label="Recherches mots-clés" value={data.totals.seoKeywordSets ?? 0} />
              <Stat icon={MessageSquare} label="Conversations" value={data.totals.conversations ?? 0} />
            </div>

            {(data.totals.orphanRows > 0 || data.totals.orphanProfiles > 0) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-6 text-xs text-amber-200">
                <span className="font-semibold">Données orphelines détectées :</span>{" "}
                {data.totals.orphanRows} ligne(s) sans utilisateur rattaché
                {data.totals.orphanProfiles > 0 && `, dont ${data.totals.orphanProfiles} profil(s) business`}.
                Ces lignes datent d'avant l'authentification et ne sont pas rattachées à un compte.
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Rechercher par email ou identifiant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
                data-testid="input-admin-search"
              />
            </div>

            {/* Users list */}
            {filtered.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-10">
                Aucun utilisateur ne correspond.
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Utilisateur</th>
                        <th className="px-3 py-3">Inscrit le</th>
                        <th className="px-3 py-3">Dernière activité</th>
                        <th className="px-3 py-3">Profil</th>
                        <th className="px-3 py-3 text-right">Projets</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => {
                        const total = totalProjects(u.counters);
                        return (
                          <tr
                            key={u.id}
                            className="border-t border-border/40 hover:bg-muted/30 cursor-pointer"
                            onClick={() => setOpenUserId(u.id)}
                            data-testid={`row-user-${u.id}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 font-medium">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[260px]">{u.email ?? "—"}</span>
                                {u.isAdmin && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[#5b54d6]/15 text-[#5b54d6] px-1.5 py-0.5 rounded">
                                    <Shield className="w-2.5 h-2.5" /> ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[260px]">
                                {u.id}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              <Calendar className="w-3 h-3 inline mr-1" />
                              {fmtDateShort(u.firstSeenAt)}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(u.lastSeenAt)}
                            </td>
                            <td className="px-3 py-3">
                              {u.hasBusinessProfile ? (
                                <span className="inline-flex items-center gap-1 text-xs text-[#1a7a55]">
                                  <Briefcase className="w-3.5 h-3.5" /> Rempli
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="inline-flex items-center gap-2 text-xs">
                                <span className="font-bold text-base">{total}</span>
                                <span className="text-muted-foreground">éléments</span>
                              </span>
                              <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                                {u.counters.agencyCampaigns}A · {u.counters.scheduledPosts}P · {u.counters.landingPages}L · {u.counters.seoAudits + u.counters.seoKeywordSets + u.counters.seoContentPlans}S
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-3">
              Légende des compteurs : A = agence · P = posts programmés · L = landing pages · S = SEO (audits + mots-clés + plans).
            </p>
          </>
        )}
      </main>

      {openUserId && <UserDetailPanel userId={openUserId} onClose={() => setOpenUserId(null)} />}
    </div>
  );
}
