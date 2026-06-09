import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, MapPin, Send, ArrowLeft, CheckCircle2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi.");
      }
      setSent(true);
      toast.success("Message envoyé !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080F", color: "#fff" }}>
      {/* Navbar minimale */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
          background: "rgba(8,8,15,0.85)",
          borderBottom: "1px solid rgba(91,84,214,0.15)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px clamp(16px,5vw,48px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
                color: "#fff",
              }}
            >
              G
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>GrowIQ</span>
          </Link>
          <Link href="/">
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <ArrowLeft size={14} /> Retour
            </span>
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px clamp(16px,5vw,48px) 80px" }}>
        {/* Titre */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 800,
              lineHeight: 1.15,
              background: "linear-gradient(135deg, #fff 30%, #5B54D6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Contactez-nous
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 18, marginTop: 12, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
            Une question, une demande, un partenariat ? Notre équipe vous répond rapidement.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          {/* Colonne gauche : infos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div style={{ background: "rgba(91,84,214,0.08)", border: "1px solid rgba(91,84,214,0.2)", borderRadius: 16, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #5B54D6, #C026D3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mail size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Email</div>
                  <a href="mailto:contact@growiq.tech" style={{ color: "#5B54D6", fontSize: 14, textDecoration: "none" }}>contact@growiq.tech</a>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #5B54D6, #C026D3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Basé en France</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Support en français</div>
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(91,84,214,0.05)", border: "1px solid rgba(91,84,214,0.12)", borderRadius: 16, padding: 28 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Pourquoi nous contacter ?</h3>
              <ul style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 2, listStyle: "none", padding: 0 }}>
                <li>Support technique et aide à la configuration</li>
                <li>Questions sur les offres et tarifs</li>
                <li>Demandes de partenariat</li>
                <li>Suggestions et retours produit</li>
              </ul>
            </div>
          </div>

          {/* Colonne droite : formulaire */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 32 }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <CheckCircle2 size={48} color="#22c55e" style={{ marginBottom: 16 }} />
                <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Message envoyé !</h3>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 24 }}>
                  Nous vous répondrons dans les meilleurs délais.
                </p>
                <Button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }} variant="outline" style={{ borderColor: "rgba(91,84,214,0.4)" }}>
                  Envoyer un autre message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <Label htmlFor="name" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 6, display: "block" }}>Nom *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Votre nom"
                    required
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
                <div>
                  <Label htmlFor="email" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 6, display: "block" }}>Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="votre@email.com"
                    required
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
                <div>
                  <Label htmlFor="subject" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 6, display: "block" }}>Sujet</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="De quoi souhaitez-vous parler ?"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
                <div>
                  <Label htmlFor="message" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 6, display: "block" }}>Message *</Label>
                  <textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Décrivez votre demande..."
                    required
                    rows={5}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 14,
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                    border: "none",
                    height: 44,
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send size={16} style={{ marginRight: 8 }} />}
                  Envoyer le message
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer minimal */}
      <footer style={{ borderTop: "1px solid rgba(91,84,214,0.15)", padding: "24px 0", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          GrowIQ.tech — Tous droits réservés
        </p>
      </footer>
    </div>
  );
}
