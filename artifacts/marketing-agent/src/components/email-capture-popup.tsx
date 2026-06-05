import { useEffect, useState } from "react";

const STORAGE_KEY = "popup_seen";
const SHOW_DELAY_MS = 30000;
const AUTO_CLOSE_MS = 4000;

const appHref = (import.meta.env.BASE_URL + "app").replace(/\/{2,}/g, "/");

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const popupStyles = `
.gqpop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: gqpop-fade 0.35s ease;
}
@keyframes gqpop-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.gqpop-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: #0F0F1A;
  border: 1px solid rgba(91, 84, 214, 0.3);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  animation: gqpop-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
@keyframes gqpop-pop {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.gqpop-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.3);
  font-size: 22px;
  line-height: 1;
  transition: color 0.2s;
}
.gqpop-close:hover { color: #fff; }
.gqpop-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px 18px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.gqpop-input::placeholder { color: rgba(255, 255, 255, 0.3); }
.gqpop-input:focus { border-color: rgba(91, 84, 214, 0.6); }
.gqpop-input.gqpop-input-error { border-color: #EF4444; }
.gqpop-submit {
  width: 100%;
  background: linear-gradient(135deg, #5B54D6, #C026D3);
  border: none;
  border-radius: 50px;
  padding: 14px;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  transition: box-shadow 0.25s ease;
}
.gqpop-submit:hover { box-shadow: 0 8px 30px rgba(91, 84, 214, 0.5); }
.gqpop-cta {
  display: inline-block;
  text-decoration: none;
  background: linear-gradient(135deg, #5B54D6, #C026D3);
  border-radius: 50px;
  padding: 14px 28px;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  transition: box-shadow 0.25s ease;
}
.gqpop-cta:hover { box-shadow: 0 8px 30px rgba(91, 84, 214, 0.5); }
@media (max-width: 639px) {
  .gqpop-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .gqpop-card {
    max-width: 100%;
    border-radius: 24px 24px 0 0;
    padding: 32px 24px;
    animation: gqpop-slideup 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
}
@keyframes gqpop-slideup {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
`;

export function EmailCapturePopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Déclencheurs : 30 s de présence OU exit-intent (souris vers le haut).
  // Une seule fois par visiteur via localStorage.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      return;
    }

    let shown = false;
    const timer = window.setTimeout(triggerShow, SHOW_DELAY_MS);

    function triggerShow() {
      if (shown) return;
      shown = true;
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* ignore */
      }
      setOpen(true);
      cleanup();
    }

    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) triggerShow();
    }

    function cleanup() {
      window.clearTimeout(timer);
      document.removeEventListener("mouseleave", onMouseLeave);
    }

    document.addEventListener("mouseleave", onMouseLeave);
    return cleanup;
  }, []);

  // Fermeture automatique 4 s après confirmation.
  useEffect(() => {
    if (!submitted) return;
    const t = window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [submitted]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError(true);
      return;
    }
    setError(false);
    setSubmitted(true);
  };

  return (
    <>
      <style>{popupStyles}</style>
      <div
        className="gqpop-overlay"
        onClick={() => setOpen(false)}
        role="presentation"
        data-testid="email-popup-overlay"
      >
        <div
          className="gqpop-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Recevoir un exemple de campagne GrowIQ"
          data-testid="email-popup"
        >
          <button
            type="button"
            className="gqpop-close"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            data-testid="email-popup-close"
          >
            ✕
          </button>

          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>✅</div>
              <h2
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-0.02em",
                  margin: "0 0 10px",
                }}
              >
                C'est dans ta boîte !
              </h2>
              <p
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  margin: "0 0 24px",
                }}
              >
                Vérifie tes emails dans 2 minutes. Et pendant ce temps... pourquoi ne pas lancer ta
                première campagne ?
              </p>
              <a href={appHref} className="gqpop-cta" data-testid="email-popup-cta">
                Lancer ma première campagne →
              </a>
            </div>
          ) : (
            <>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "5px 12px",
                  borderRadius: 50,
                  marginBottom: 18,
                }}
              >
                🎯 Exemple gratuit
              </span>
              <h2
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-0.02em",
                  margin: "0 0 10px",
                  lineHeight: 1.25,
                }}
              >
                Tu veux voir une vraie campagne générée par GrowIQ ?
              </h2>
              <p
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  margin: "0 0 22px",
                }}
              >
                Laisse ton email — on t'envoie un exemple concret adapté à ton secteur. Gratuit, en 2
                minutes.
              </p>
              <form onSubmit={handleSubmit} noValidate>
                <input
                  type="email"
                  className={"gqpop-input" + (error ? " gqpop-input-error" : "")}
                  placeholder="Ton adresse email..."
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(false);
                  }}
                  aria-invalid={error}
                  data-testid="email-popup-input"
                  autoComplete="email"
                />
                {error ? (
                  <p
                    style={{ color: "#EF4444", fontSize: 12, margin: "8px 2px 0" }}
                    data-testid="email-popup-error"
                  >
                    Adresse email invalide
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="gqpop-submit"
                  style={{ marginTop: 16 }}
                  data-testid="email-popup-submit"
                >
                  Recevoir mon exemple gratuit →
                </button>
              </form>
              <p
                style={{
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 11,
                  textAlign: "center",
                  margin: "14px 0 0",
                }}
              >
                Pas de spam. Désabonnement en 1 clic.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
