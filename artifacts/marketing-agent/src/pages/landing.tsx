import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";

interface LandingData {
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  successMessage: string;
  fields: string[];
  style: { primaryColor?: string; bgColor?: string; heroImage?: string };
}

export default function LandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [page, setPage] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/public/landing/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPage(d))
      .catch(() => setError("Cette page n'existe pas ou plus."))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/landing/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as Error).message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">{error || "Page introuvable"}</p>
      </div>
    );
  }

  const primary = page.style.primaryColor || "#4f46e5";
  const bg = page.style.bgColor || "#08080F";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: bg }}>
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-xl p-8 sm:p-10">
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: `${primary}20`, color: primary }}>
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">C'est noté !</h2>
            <p className="text-muted-foreground">{page.successMessage}</p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">{page.headline}</h1>
            {page.subheadline && <p className="text-muted-foreground text-lg mb-6">{page.subheadline}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              {page.fields.includes("name") && (
                <input
                  type="text"
                  placeholder="Votre prénom"
                  required
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-offset-1 text-foreground"
                  style={{ "--tw-ring-color": primary } as React.CSSProperties}
                  data-testid="lp-input-name"
                />
              )}
              <input
                type="email"
                placeholder="Votre email"
                required
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 text-foreground"
                data-testid="lp-input-email"
              />
              {page.fields.includes("phone") && (
                <input
                  type="tel"
                  placeholder="Téléphone (optionnel)"
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 text-foreground"
                  data-testid="lp-input-phone"
                />
              )}
              {page.fields.includes("message") && (
                <textarea
                  placeholder="Votre message (optionnel)"
                  rows={3}
                  value={form.message || ""}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 text-foreground resize-none"
                  data-testid="lp-input-message"
                />
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: primary }}
                data-testid="lp-submit"
              >
                {submitting ? "Envoi…" : page.ctaLabel}
              </button>
            </form>
            <p className="text-xs text-muted-foreground text-center mt-6">
              Vos informations restent confidentielles · {page.title}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
