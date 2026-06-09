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
  FolderPlus,
  Folder,
  FolderOpen,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Folder = {
  id: number;
  name: string;
  color: string;
  contactCount: number;
  createdAt: string;
};

type Contact = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  tags: string[];
  folderId: number | null;
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <h1 className="text-lg font-bold text-foreground">Emails</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex gap-2 bg-card rounded-xl border p-1 w-fit shadow-sm">
          <button
            onClick={() => setTab("contacts")}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2",
              tab === "contacts" ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Users className="w-4 h-4" /> Contacts
          </button>
          <button
            onClick={() => setTab("campaigns")}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2",
              tab === "campaigns" ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:bg-muted",
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
  const [activeFolder, setActiveFolder] = useState<number | null>(null); // null = tous
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<number | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [importFolderId, setImportFolderId] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingCsvRows, setPendingCsvRows] = useState<Array<{ email: string; firstName?: string; lastName?: string }>>([]);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["email-contacts"],
    queryFn: () => af("/api/email/contacts") as Promise<Contact[]>,
  });

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["email-folders"],
    queryFn: () => af("/api/email/folders") as Promise<Folder[]>,
  });

  const createFolder = useMutation({
    mutationFn: (name: string) =>
      af("/api/email/folders", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-folders"] });
      setCreatingFolder(false);
      setNewFolderName("");
      toast.success("Dossier créé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      af(`/api/email/folders/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-folders"] });
      setRenamingFolder(null);
      setRenameFolderName("");
      toast.success("Dossier renommé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteFolder = useMutation({
    mutationFn: (id: number) => af(`/api/email/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-folders"] });
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      if (activeFolder) setActiveFolder(null);
      toast.success("Dossier supprimé (contacts conservés)");
    },
  });

  const addContact = useMutation({
    mutationFn: (payload: { email: string; firstName?: string; lastName?: string }) =>
      af("/api/email/contacts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      qc.invalidateQueries({ queryKey: ["email-folders"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      qc.invalidateQueries({ queryKey: ["email-folders"] });
    },
  });

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState<number | null>(null);

  const moveToFolder = useMutation({
    mutationFn: (payload: { allInFolder: boolean; fromFolderId: number | null; toFolderId: number | null }) =>
      af("/api/email/contacts/move-to-folder", {
        method: "POST",
        body: JSON.stringify(payload),
      }) as Promise<{ moved: number }>,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      qc.invalidateQueries({ queryKey: ["email-folders"] });
      toast.success(`${data.moved} contact(s) déplacé(s)`);
      setShowMoveModal(false);
      setMoveFolderId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkImport = useMutation({
    mutationFn: (payload: { contacts: Array<{ email: string; firstName?: string; lastName?: string }>; folderId?: number }) =>
      af("/api/email/contacts/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      }) as Promise<{ requested: number; inserted: number; skipped: number }>,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      qc.invalidateQueries({ queryKey: ["email-folders"] });
      toast.success(`${data.inserted} contact(s) importé(s), ${data.skipped} déjà existant(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleCsvParsed(file: File) {
    setImporting(true);
    file.text().then((text) => {
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Aucun email valide trouvé dans ce fichier.");
        setImporting(false);
        return;
      }
      setPendingCsvRows(rows);
      setShowImportModal(true);
      setImporting(false);
    }).catch(() => {
      toast.error("Impossible de lire le fichier.");
      setImporting(false);
    });
  }

  async function confirmImport() {
    try {
      await bulkImport.mutateAsync({
        contacts: pendingCsvRows,
        folderId: importFolderId ?? undefined,
      });
    } finally {
      setShowImportModal(false);
      setPendingCsvRows([]);
      setImportFolderId(null);
    }
  }

  const filtered = useMemo(() => {
    let list = contacts;
    // Filtre par dossier : null = sans dossier (non classés), number = dossier spécifique
    if (activeFolder === null || activeFolder === -1) {
      // "Tous" et "Sans dossier" montrent uniquement les contacts non classés
      list = list.filter((c) => !c.folderId);
    } else {
      list = list.filter((c) => c.folderId === activeFolder);
    }
    // Filtre par recherche
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [contacts, query, activeFolder]);

  const unfolderedCount = contacts.filter((c) => !c.folderId).length;

  return (
    <div className="flex gap-6">
      {/* ── Sidebar Dossiers ── */}
      <div className="w-56 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dossiers</h3>
          <button onClick={() => setCreatingFolder(true)} className="text-violet-600 hover:text-violet-400" title="Nouveau dossier">
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {creatingFolder && (
          <div className="flex gap-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nom du dossier"
              className="text-xs h-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) createFolder.mutate(newFolderName.trim());
                if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
              }}
            />
            <Button size="sm" className="h-8 px-2" onClick={() => { if (newFolderName.trim()) createFolder.mutate(newFolderName.trim()); }}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}

        <button
          onClick={() => setActiveFolder(null)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition",
            activeFolder === null ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Users className="w-4 h-4" />
          <span className="flex-1 text-left">Non classés</span>
          <span className="text-xs opacity-70">{contacts.filter((c) => !c.folderId).length}</span>
        </button>

        {folders.map((f) => (
          <div key={f.id} className="group relative">
            {renamingFolder === f.id ? (
              <div className="flex gap-1">
                <Input
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  className="text-xs h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameFolderName.trim()) renameFolder.mutate({ id: f.id, name: renameFolderName.trim() });
                    if (e.key === "Escape") setRenamingFolder(null);
                  }}
                />
                <Button size="sm" className="h-8 px-2" onClick={() => { if (renameFolderName.trim()) renameFolder.mutate({ id: f.id, name: renameFolderName.trim() }); }}>
                  OK
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setActiveFolder(f.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition",
                  activeFolder === f.id ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {activeFolder === f.id ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                <span className="flex-1 text-left truncate">{f.name}</span>
                <span className="text-xs opacity-70">{f.contactCount}</span>
              </button>
            )}
            {renamingFolder !== f.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setRenamingFolder(f.id); setRenameFolderName(f.name); }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Renommer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer le dossier "${f.name}" ? Les contacts seront conservés.`)) deleteFolder.mutate(f.id); }}
                  className="p-1 rounded hover:bg-muted text-red-500 hover:text-red-400"
                  title="Supprimer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* "Sans dossier" supprimé — "Non classés" remplit ce rôle */}
      </div>

      {/* ── Contenu principal ── */}
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Chercher un contact…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Button onClick={() => setAdding((v) => !v)} variant={adding ? "secondary" : "default"}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border rounded-md text-sm font-medium cursor-pointer hover:bg-muted">
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
                if (f) handleCsvParsed(f);
                e.target.value = "";
              }}
            />
          </label>
          {filtered.length > 0 && folders.length > 0 && (
            <Button variant="outline" onClick={() => setShowMoveModal(true)}>
              <Folder className="w-4 h-4 mr-1" /> Déplacer vers un dossier
            </Button>
          )}
        </div>

        {/* Modal de déplacement vers un dossier */}
        {showMoveModal && (
          <div className="bg-card rounded-xl border p-5 space-y-4 shadow-lg">
            <h3 className="font-semibold">
              Déplacer {activeFolder === null ? "tous les" : filtered.length} contact(s)
              {activeFolder === -1 ? " (sans dossier)" : activeFolder !== null ? ` du dossier "${folders.find((f) => f.id === activeFolder)?.name}"` : ""} vers :
            </h3>
            <div className="flex flex-wrap gap-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMoveFolderId(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm border transition flex items-center gap-1.5",
                    moveFolderId === f.id ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted",
                  )}
                >
                  <Folder className="w-3.5 h-3.5" /> {f.name}
                </button>
              ))}
              <button
                onClick={() => setMoveFolderId(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border transition",
                  moveFolderId === null ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted",
                )}
              >
                Retirer du dossier
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowMoveModal(false); setMoveFolderId(null); }}>Annuler</Button>
              <Button
                onClick={() => moveToFolder.mutate({
                  allInFolder: true,
                  fromFolderId: activeFolder === -1 ? null : activeFolder,
                  toFolderId: moveFolderId,
                })}
                disabled={moveToFolder.isPending}
              >
                {moveToFolder.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Déplacer
              </Button>
            </div>
          </div>
        )}

        {/* Modal de choix de dossier à l'import */}
        {showImportModal && (
          <div className="bg-card rounded-xl border p-5 space-y-4 shadow-lg">
            <h3 className="font-semibold">Importer {pendingCsvRows.length} contact(s)</h3>
            <p className="text-sm text-muted-foreground">Dans quel dossier veux-tu importer ces contacts ?</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setImportFolderId(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border transition",
                  importFolderId === null ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted",
                )}
              >
                Aucun dossier
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setImportFolderId(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm border transition flex items-center gap-1.5",
                    importFolderId === f.id ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted",
                  )}
                >
                  <Folder className="w-3.5 h-3.5" /> {f.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowImportModal(false); setPendingCsvRows([]); }}>Annuler</Button>
              <Button onClick={confirmImport} disabled={bulkImport.isPending}>
                {bulkImport.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Importer
              </Button>
            </div>
          </div>
        )}

        {adding && (
          <div className="bg-card rounded-xl border p-4 space-y-3 shadow-sm">
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

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {contacts.length === 0
                ? "Aucun contact pour l'instant. Ajoutes-en un ou importe un CSV."
                : activeFolder !== null
                  ? "Aucun contact dans ce dossier."
                  : "Aucun résultat pour cette recherche."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Prénom</th>
                  <th className="text-left px-4 py-3">Nom</th>
                  {activeFolder === null && <th className="text-left px-4 py-3">Dossier</th>}
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const folder = folders.find((f) => f.id === c.folderId);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted">
                      <td className="px-4 py-3 font-medium">{c.email}</td>
                      <td className="px-4 py-3">{c.firstName}</td>
                      <td className="px-4 py-3">{c.lastName}</td>
                      {activeFolder === null && (
                        <td className="px-4 py-3">
                          {folder ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              <Folder className="w-3 h-3" /> {folder.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.source}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer ${c.email} ?`)) deleteContact.mutate(c.id);
                          }}
                          className="text-red-600 hover:text-red-300"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} contact(s) affiché(s) sur {contacts.length} au total. Les doublons sont ignorés à l'import.
        </p>
      </div>
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
        <p className="text-sm text-muted-foreground">
          Crée tes campagnes depuis l'<Link href="/app/agency" className="text-violet-600 font-semibold hover:underline">Agence automatique</Link> → option « Campagne Emailing ».
        </p>
      </div>

      {isLoading ? (
        <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Aucune campagne envoyée pour le moment.
        </div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="bg-card rounded-xl border p-4 text-left hover:border-violet-300 hover:shadow transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">
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
                    className="text-red-600 hover:text-red-300 p-1 cursor-pointer"
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
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const map: Record<Campaign["status"], { label: string; cls: string; icon: React.ReactNode }> = {
    draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground", icon: null },
    sending: { label: "Envoi…", cls: "bg-blue-500/100/15 text-blue-300", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    sent: { label: "Envoyée", cls: "bg-green-500/100/15 text-green-300", icon: <CheckCircle2 className="w-3 h-3" /> },
    partially_failed: { label: "Partiel", cls: "bg-amber-500/100/15 text-amber-300", icon: <AlertCircle className="w-3 h-3" /> },
    failed: { label: "Échec", cls: "bg-red-500/100/15 text-red-300", icon: <XCircle className="w-3 h-3" /> },
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
  const qc = useQueryClient();
  const isDraft = campaign.status === "draft";

  const { data } = useQuery<Campaign & { stats?: Record<string, number> }>({
    queryKey: ["email-campaign", campaign.id],
    queryFn: () =>
      af(`/api/email/campaigns/${campaign.id}`) as Promise<Campaign & { stats?: Record<string, number> }>,
    refetchInterval: campaign.status === "sending" ? 3000 : false,
  });
  const c = data ?? campaign;

  // État édition (brouillons uniquement)
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(c.subject);
  const [editName, setEditName] = useState(c.name);

  // État envoi
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendFolderId, setSendFolderId] = useState<number | null>(null);
  const [sendAll, setSendAll] = useState(false);

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["email-folders"],
    queryFn: () => af("/api/email/folders") as Promise<Folder[]>,
  });

  const updateCampaign = useMutation({
    mutationFn: (payload: { name?: string; subject?: string }) =>
      af(`/api/email/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-campaign", campaign.id] });
      qc.invalidateQueries({ queryKey: ["email-campaigns"] });
      setEditing(false);
      toast.success("Campagne mise à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendCampaign = useMutation({
    mutationFn: (payload: { folderId?: number; allSubscribed?: boolean }) =>
      af(`/api/email/campaigns/${campaign.id}/send`, { method: "POST", body: JSON.stringify(payload) }) as Promise<{ sent: number; failed: number; total: number }>,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-campaign", campaign.id] });
      qc.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast.success(`Campagne envoyée : ${data.sent} email(s) envoyé(s)`);
      setShowSendModal(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-violet-600 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Retour aux campagnes
      </button>
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          {editing ? (
            <div className="flex-1 space-y-2">
              <div>
                <Label className="text-xs">Nom de la campagne</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Sujet de l'email</Label>
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateCampaign.mutate({ name: editName, subject: editSubject })} disabled={updateCampaign.isPending}>
                  {updateCampaign.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                  Sauvegarder
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{c.name}</h2>
              <p className="text-muted-foreground mt-1">{c.subject}</p>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={c.status} />
            {isDraft && !editing && (
              <button onClick={() => { setEditName(c.name); setEditSubject(c.subject); setEditing(true); }} className="text-muted-foreground hover:text-violet-600" title="Modifier">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t">
          <BigStat label="Destinataires" value={c.recipientCount} />
          <BigStat label="Envoyés" value={c.sentCount} color="text-green-600" />
          <BigStat label="Échecs" value={c.failedCount} color="text-red-600" />
          <BigStat label="Ouvertures" value={c.openCount} color="text-violet-600" />
          <BigStat label="Clics" value={c.clickCount} color="text-blue-600" />
        </div>

        {/* Bouton Envoyer pour les brouillons */}
        {isDraft && (
          <div className="pt-4 border-t">
            {!showSendModal ? (
              <Button onClick={() => setShowSendModal(true)} className="bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4 mr-2" /> Envoyer cette campagne
              </Button>
            ) : (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm">Choisir les destinataires :</h3>
                <div className="flex flex-wrap gap-2">
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setSendFolderId(f.id); setSendAll(false); }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm border transition flex items-center gap-1.5",
                        sendFolderId === f.id && !sendAll ? "bg-violet-600 text-white border-violet-600" : "hover:bg-card",
                      )}
                    >
                      <Folder className="w-3.5 h-3.5" /> {f.name} ({f.contactCount})
                    </button>
                  ))}
                  <button
                    onClick={() => { setSendAll(true); setSendFolderId(null); }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm border transition",
                      sendAll ? "bg-violet-600 text-white border-violet-600" : "hover:bg-card",
                    )}
                  >
                    Tous les abonnés
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => sendCampaign.mutate(sendAll ? { allSubscribed: true } : { folderId: sendFolderId! })}
                    disabled={sendCampaign.isPending || (!sendAll && !sendFolderId)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {sendCampaign.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    Confirmer l'envoi
                  </Button>
                  <Button variant="ghost" onClick={() => setShowSendModal(false)}>Annuler</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-card rounded-xl border p-6 space-y-2">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Aperçu de l'email</h3>
        <div
          className="prose prose-sm max-w-none border rounded-lg p-4 bg-muted"
          // Email HTML généré par notre propre IA — pas d'input utilisateur direct ici.
          dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(c.bodyHtml) }}
        />
      </div>
    </div>
  );
}

function BigStat({ label, value, color = "text-foreground" }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-3xl font-bold", color)}>{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
    </div>
  );
}
