import { useMemo, useState } from "react";
import { Link } from "wouter";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  Mail,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Search,
  Eye,
  MousePointerClick,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Contact = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  tags: string[];
  subscribed: boolean;
  source: string;
  createdAt: string;
};

type Campaign = {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: "draft" | "sending" | "sent" | "partially_failed" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openCount: number;
  clickCount: number;
  sentAt: string | null;
  createdAt: string;
};

function useAuthedFetch() {
  const { getToken } = useAuth();
  return async (path: string, init?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${basePath}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(body) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  };
}

// ── CSV parsing très simple (1 colonne ou email,prenom,nom) ────────────────
function parseCsv(text: string): Array<{ email: string; firstName?: string; lastName?: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  // Détecte la présence d'un header
  const first = lines[0]!.toLowerCase();
  const hasHeader = first.includes("email") || first.includes("mail");
  const rows = hasHeader ? lines.slice(1) : lines;
  const out: Array<{ email: string; firstName?: string; lastName?: string }> = [];
  for (const line of rows) {
    const cells = line.split(/[,;]\s*/).map((c) => c.replace(/^"|"$/g, "").trim());
    const email = cells.find((c) => /@/.test(c));
    if (!email) continue;
    const others = cells.filter((c) => c !== email && c.length > 0);
    out.push({ email, firstName: others[0], lastName: others[1] });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const [tab, setTab] = useState<"contacts" | "campaigns">("contacts");

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50">
      <header className="border-b border-violet-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <h1 className="text-lg font-bold text-[#1e1b4b]">Emails</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex gap-2 bg-white rounded-xl border p-1 w-fit shadow-sm">
          <button
            onClick={() => setTab("contacts")}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2",
              tab === "contacts" ? "bg-violet-600 text-white shadow" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            <Users className="w-4 h-4" /> Contacts
          </button>
          <button
            onClick={() => setTab("campaigns")}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2",
              tab === "campaigns" ? "bg-violet-600 text-white shadow" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            <Mail className="w-4 h-4" /> Campagnes
          </button>
        </div>

        {tab === "contacts" ? <ContactsTab /> : <CampaignsTab />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────────────────────────────────────

function ContactsTab() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["email-contacts"],
    queryFn: () => af("/api/email/contacts") as Promise<Contact[]>,
  });

  const addContact = useMutation({
    mutationFn: (payload: { email: string; firstName?: string; lastName?: string }) =>
      af("/api/email/contacts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      setNewEmail("");
      setNewFirst("");
      setNewLast("");
      setAdding(false);
      toast.success("Contact ajouté");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteContact = useMutation({
    mutationFn: (id: number) => af(`/api/email/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-contacts"] }),
  });

  const bulkImport = useMutation({
    mutationFn: (rows: Array<{ email: string; firstName?: string; lastName?: string }>) =>
      af("/api/email/contacts/bulk", {
        method: "POST",
        body: JSON.stringify({ contacts: rows }),
      }) as Promise<{ requested: number; inserted: number; skipped: number }>,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      toast.success(`${data.inserted} contact(s) importé(s), ${data.skipped} déjà existant(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleCsvFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Aucun email valide trouvé dans ce fichier.");
        return;
      }
      await bulkImport.mutateAsync(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setImporting(false);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Chercher un contact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button onClick={() => setAdding((v) => !v)} variant={adding ? "secondary" : "default"}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
        <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border rounded-md text-sm font-medium cursor-pointer hover:bg-gray-50">
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Importer CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCsvFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Email *</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nom@exemple.com" />
            </div>
            <div>
              <Label className="text-xs">Prénom</Label>
              <Input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nom</Label>
              <Input value={newLast} onChange={(e) => setNewLast(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Annuler
            </Button>
            <Button
              disabled={!newEmail.includes("@") || addContact.isPending}
              onClick={() =>
                addContact.mutate({ email: newEmail, firstName: newFirst, lastName: newLast })
              }
            >
              {addContact.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            {contacts.length === 0
              ? "Aucun contact pour l'instant. Ajoutes-en un ou importe un CSV."
              : "Aucun résultat pour cette recherche."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Prénom</th>
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.email}</td>
                  <td className="px-4 py-3">{c.firstName}</td>
                  <td className="px-4 py-3">{c.lastName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.source}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer ${c.email} ?`)) deleteContact.mutate(c.id);
                      }}
                      className="text-red-600 hover:text-red-800"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {contacts.length} contact(s) au total. Les doublons sont ignorés à l'import.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Campagnes
// ─────────────────────────────────────────────────────────────────────────────

function CampaignsTab() {
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["email-campaigns"],
    queryFn: () => af("/api/email/campaigns") as Promise<Campaign[]>,
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: number) => af(`/api/email/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-campaigns"] }),
  });

  if (selected) {
    return <CampaignDetail campaign={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Crée tes campagnes depuis l'<Link href="/app/agency" className="text-violet-600 font-semibold hover:underline">Agence automatique</Link> → option « Campagne Emailing ».
        </p>
      </div>

      {isLoading ? (
        <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-sm text-gray-500">
          Aucune campagne envoyée pour le moment.
        </div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="bg-white rounded-xl border p-4 text-left hover:border-violet-300 hover:shadow transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-gray-600 truncate">{c.subject}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.sentAt
                      ? `Envoyée le ${new Date(c.sentAt).toLocaleString("fr-FR")}`
                      : `Créée le ${new Date(c.createdAt).toLocaleString("fr-FR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <Stat icon={<Send className="w-3.5 h-3.5" />} value={c.sentCount} label="Envoi" />
                  <Stat icon={<Eye className="w-3.5 h-3.5" />} value={c.openCount} label="Ouv." />
                  <Stat icon={<MousePointerClick className="w-3.5 h-3.5" />} value={c.clickCount} label="Clics" />
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Supprimer "${c.name}" ?`)) deleteCampaign.mutate(c.id);
                    }}
                    className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-12">
      <div className="flex items-center gap-1 text-violet-600">
        {icon}
        <span className="font-bold">{value}</span>
      </div>
      <span className="text-[10px] uppercase text-gray-400">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const map: Record<Campaign["status"], { label: string; cls: string; icon: React.ReactNode }> = {
    draft: { label: "Brouillon", cls: "bg-gray-100 text-gray-700", icon: null },
    sending: { label: "Envoi…", cls: "bg-blue-100 text-blue-700", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    sent: { label: "Envoyée", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
    partially_failed: { label: "Partiel", cls: "bg-amber-100 text-amber-800", icon: <AlertCircle className="w-3 h-3" /> },
    failed: { label: "Échec", cls: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  };
  const m = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", m.cls)}>
      {m.icon}
      {m.label}
    </span>
  );
}

function CampaignDetail({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const af = useAuthedFetch();
  const { data } = useQuery<Campaign & { stats?: Record<string, number> }>({
    queryKey: ["email-campaign", campaign.id],
    queryFn: () =>
      af(`/api/email/campaigns/${campaign.id}`) as Promise<Campaign & { stats?: Record<string, number> }>,
    refetchInterval: campaign.status === "sending" ? 3000 : false,
  });
  const c = data ?? campaign;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-violet-600 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Retour aux campagnes
      </button>
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{c.name}</h2>
            <p className="text-gray-600 mt-1">{c.subject}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t">
          <BigStat label="Destinataires" value={c.recipientCount} />
          <BigStat label="Envoyés" value={c.sentCount} color="text-green-600" />
          <BigStat label="Échecs" value={c.failedCount} color="text-red-600" />
          <BigStat label="Ouvertures" value={c.openCount} color="text-violet-600" />
          <BigStat label="Clics" value={c.clickCount} color="text-blue-600" />
        </div>
      </div>
      <div className="bg-white rounded-xl border p-6 space-y-2">
        <h3 className="font-semibold text-sm uppercase text-gray-500">Aperçu de l'email</h3>
        <div
          className="prose prose-sm max-w-none border rounded-lg p-4 bg-gray-50"
          // Email HTML généré par notre propre IA — pas d'input utilisateur direct ici.
          dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(c.bodyHtml) }}
        />
      </div>
    </div>
  );
}

function BigStat({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-3xl font-bold", color)}>{value}</div>
      <div className="text-[10px] uppercase text-gray-500 tracking-wider">{label}</div>
    </div>
  );
}
