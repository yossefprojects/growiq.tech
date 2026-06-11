import { useState, useEffect, useRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { EmailCapturePopup } from "@/components/email-capture-popup";

function SmartLink({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  if (internal) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal,.reveal-left,.reveal-right");
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("visible"));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.1 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: 60,
        background: scrolled ? "rgba(8, 8, 15, 0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(91,84,214,0.2)" : "none",
        transition: "all .35s ease",
        display: "flex",
        alignItems: "center",
        padding: "0 clamp(16px, 5vw, 48px)",
        gap: 32,
      }}
    >
      <SmartLink
        href="/"
        style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "linear-gradient(135deg, #5B54D6, #C026D3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            boxShadow: "0 4px 14px rgba(91,84,214,0.45)",
          }}
        >
          ⚡
        </div>
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: "white",
            letterSpacing: "-0.03em",
          }}
        >
          Grow
          <span
            style={{
              background: "linear-gradient(135deg, #7B74E8, #C026D3)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            IQ
          </span>
        </span>
      </SmartLink>

      <div
        style={{ display: "flex", gap: 28, flex: 1, justifyContent: "center" }}
        className="nav-links-desktop"
      >
        {[
          { label: "Fonctionnalités", href: "#features" },
          { label: "Comment ça marche", href: "#how" },
          { label: "Tarifs", href: "#pricing" },
          { label: "FAQ", href: "#faq" },
        ].map((l) => (
          <SmartLink
            key={l.label}
            href={l.href}
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.65)",
              textDecoration: "none",
              transition: "color .2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
          >
            {l.label}
          </SmartLink>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ThemeToggle variant="landing" testId="theme-toggle-landing" />
        <SmartLink
          href="/app"
          style={{
            background: "linear-gradient(135deg, #5B54D6, #C026D3)",
            color: "white",
            borderRadius: 50,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(91,84,214,0.4)",
            transition: "all .2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 26px rgba(91,84,214,0.6)")}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(91,84,214,0.4)")}
        >
          Lancer gratuitement →
        </SmartLink>
      </div>
    </nav>
  );
}

function HeroSection() {
  const examples = [
    "une promo pour mon restaurant ce soir",
    "le lancement de ma nouvelle collection",
    "une campagne email pour mes clients",
    "mon ouverture de boutique samedi",
  ];
  const [exIdx, setExIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const target = examples[exIdx];
    if (typing) {
      if (displayed.length < target.length) {
        const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 40);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setTyping(false), 1800);
        return () => clearTimeout(t);
      }
    } else {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 18);
        return () => clearTimeout(t);
      } else {
        setExIdx((exIdx + 1) % examples.length);
        setTyping(true);
        return;
      }
    }
  }, [displayed, typing, exIdx]);

  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "linear-gradient(160deg, #08080F 0%, #0F0F1A 60%, #08080F 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        paddingTop: 60,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(91,84,214,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(91,84,214,0.04) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 400,
          background: "radial-gradient(ellipse, rgba(91,84,214,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "10%",
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(192,38,211,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {["⚡", "🎯", "📱", "✉️", "📊", "🚀", "💡", "🎨"].map((icon, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            fontSize: 18 + (i % 4) * 3 + "px",
            left: 10 + i * 11 + "%",
            top: 15 + (i % 3) * 25 + "%",
            opacity: 0.06 + (i % 3) * 0.03,
            animation: `float ${4 + i * 0.7}s ease-in-out ${i * 0.5}s infinite`,
            pointerEvents: "none",
            filter: "blur(0.5px)",
          }}
        >
          {icon}
        </div>
      ))}

      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          padding: "0 clamp(16px, 5vw, 48px)",
          maxWidth: 860,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(91,84,214,0.12)",
            border: "1px solid rgba(91,84,214,0.3)",
            borderRadius: 24,
            padding: "6px 16px",
            marginBottom: 28,
            animation: "fadeInDown .7s ease forwards",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#5B54D6",
              animation: "pulse-purple 2s infinite",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Agent marketing IA en français
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6.5vw, 72px)",
            fontWeight: 900,
            color: "white",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            marginBottom: 20,
            animation: "fadeInUp .9s ease .15s both",
          }}
        >
          Lance tes campagnes
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #7B74E8 0%, #C026D3 50%, #06B6D4 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s linear infinite",
            }}
          >
            marketing avec l'IA
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2.5vw, 19px)",
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.65,
            maxWidth: 580,
            margin: "0 auto 36px",
            animation: "fadeInUp .9s ease .3s both",
          }}
        >
          GrowIQ crée, programme et publie tes posts, emails et pubs à ta place — en moins de 10
          minutes. Sans agence. En français.
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(91,84,214,0.25)",
            borderRadius: 14,
            padding: "12px 18px",
            marginBottom: 36,
            maxWidth: "90%",
            animation: "fadeInUp .9s ease .4s both",
          }}
        >
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
            🤖 Génère
          </span>
          <span style={{ fontSize: 14, color: "white", fontStyle: "italic", minWidth: 200, textAlign: "left" }}>
            {displayed}
            <span
              style={{
                borderRight: "2px solid #5B54D6",
                marginLeft: 1,
                animation: "blink 1s step-end infinite",
              }}
            />
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 56,
            animation: "fadeInUp .9s ease .5s both",
          }}
        >
          <SmartLink
            href="/app"
            style={{
              background: "linear-gradient(135deg, #5B54D6, #C026D3)",
              color: "white",
              borderRadius: 50,
              padding: "14px 36px",
              fontSize: 16,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 8px 30px rgba(91,84,214,0.5)",
              transition: "all .25s",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 14px 40px rgba(91,84,214,0.65)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 30px rgba(91,84,214,0.5)";
            }}
          >
            ⚡ Lancer ma première campagne
          </SmartLink>
          <SmartLink
            href="#how"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 50,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              transition: "all .2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(91,84,214,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
          >
            Comment ça marche →
          </SmartLink>
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            flexWrap: "wrap",
            animation: "fadeInUp .9s ease .65s both",
          }}
        >
          {[
            { icon: "✓", text: "Gratuit pour commencer" },
            { icon: "✓", text: "Sans carte bancaire" },
            { icon: "✓", text: "100% en français" },
          ].map((p, i) => (
            <span
              key={i}
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ color: "#5B54D6", fontWeight: 700 }}>{p.icon}</span>
              {p.text}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          animation: "bounce-down 2.5s infinite",
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          scroll
        </span>
        <div
          style={{
            width: 1,
            height: 36,
            background: "linear-gradient(to bottom, rgba(91,84,214,0.5), transparent)",
          }}
        />
      </div>
    </section>
  );
}

type Target = { emoji: string; title: string; desc: string };

function AudienceCard({ target, delay }: { target: Target; delay: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="reveal"
      style={{ transitionDelay: `${delay}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          background: hovered ? "rgba(91,84,214,0.12)" : "rgba(255,255,255,0.03)",
          border: hovered ? "1px solid rgba(91,84,214,0.4)" : "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: "24px",
          transition: "all .22s cubic-bezier(.16,1,.3,1)",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          cursor: "default",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {hovered && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 30% 30%, rgba(91,84,214,0.1) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        )}
        <div
          style={{
            fontSize: 32,
            marginBottom: 12,
            transition: "transform .22s",
            transform: hovered ? "scale(1.15)" : "scale(1)",
            display: "inline-block",
          }}
        >
          {target.emoji}
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "white", marginBottom: 6 }}>
          {target.title}
        </h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
          {target.desc}
        </p>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 2,
            background: "linear-gradient(135deg, #5B54D6, #C026D3)",
            width: hovered ? "100%" : "0%",
            transition: "width .35s cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
    </div>
  );
}

function AudienceSection() {
  const targets: Target[] = [
    { emoji: "🍕", title: "Restaurateurs", desc: "Promos du jour, événements, fidélité client" },
    { emoji: "🧑‍💼", title: "Coachs & Consultants", desc: "Personal branding, offres, webinaires" },
    { emoji: "🛍️", title: "Commerçants", desc: "Soldes, nouvelles collections, ouvertures" },
    { emoji: "🔨", title: "Artisans", desc: "Témoignages clients, avant/après, devis" },
    { emoji: "🎨", title: "Créateurs", desc: "Lancements, drops, engagement communauté" },
    { emoji: "🏢", title: "Petites entreprises", desc: "Recrutement, actualités, événements B2B" },
  ];

  return (
    <section id="audience" style={{ padding: "100px clamp(16px, 5vw, 48px)", background: "#0F0F1A" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Pour qui ?
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Pas besoin d'être expert
            <br />
            <span style={{ color: "#7B74E8" }}>en marketing</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {targets.map((t, i) => (
            <AudienceCard key={i} target={t} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HowSection() {
  const steps = [
    {
      num: "01",
      icon: "💬",
      title: "Tu décris ton projet",
      desc: "Dis à GrowIQ ton activité, ta cible et ton objectif en quelques mots. Pas de formulaire compliqué — une vraie conversation.",
    },
    {
      num: "02",
      icon: "🤖",
      title: "L'IA crée tout",
      desc: "GrowIQ choisit les canaux, rédige les textes, génère les visuels et programme les publications aux meilleurs horaires.",
    },
    {
      num: "03",
      icon: "🚀",
      title: "Tu valides et tu publies",
      desc: "Tu vérifies chaque contenu avant envoi. En un clic, tout est publié sur tes réseaux, envoyé par email, ou lancé en pub.",
    },
  ];

  return (
    <section
      id="how"
      style={{
        padding: "100px clamp(16px, 5vw, 48px)",
        background: "linear-gradient(160deg, #08080F, #0F0F1A)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(to right, transparent, rgba(91,84,214,0.2), transparent)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 72 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Le process
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Une campagne prête en{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7B74E8, #C026D3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              moins de 10 minutes
            </span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {steps.map((step, i) => (
            <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.15}s` }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: "36px 28px",
                  position: "relative",
                  overflow: "hidden",
                  transition: "border-color .2s, transform .2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(91,84,214,0.35)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 20,
                    fontWeight: 900,
                    fontSize: 72,
                    color: "rgba(91,84,214,0.06)",
                    lineHeight: 1,
                    pointerEvents: "none",
                    letterSpacing: "-0.04em",
                  }}
                >
                  {step.num}
                </div>

                <div style={{ fontSize: 40, marginBottom: 20 }}>{step.icon}</div>
                <h3 style={{ fontSize: 21, fontWeight: 700, color: "white", marginBottom: 12 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>
                  {step.desc}
                </p>

                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "40%",
                    height: 2,
                    background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                    borderRadius: "0 2px 0 0",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: "📱",
      title: "Posts réseaux sociaux",
      desc: "Facebook, Instagram, LinkedIn — textes, visuels et hashtags générés automatiquement et programmés aux meilleurs horaires.",
      tag: "Gratuit",
    },
    {
      icon: "✉️",
      title: "Campagnes email",
      desc: "Newsletters, séquences de bienvenue, relances — rédigées, mises en page et envoyées à ta liste.",
      tag: "Gratuit",
    },
    {
      icon: "🎨",
      title: "Visuels IA",
      desc: "Images, bannières et stories générées par IA, adaptées à chaque réseau et à ton identité visuelle.",
      tag: "Inclus",
    },
    {
      icon: "💰",
      title: "Publicités payantes",
      desc: "Meta Ads et Google Ads — ciblage, accroches, budgets et enchères gérés par GrowIQ.",
      tag: "Pro",
    },
    {
      icon: "📊",
      title: "Analytics en temps réel",
      desc: "Portée, clics, leads, conversions — tout dans un tableau de bord simple, sans jargon.",
      tag: "Inclus",
    },
    {
      icon: "🎯",
      title: "Pages de capture",
      desc: "Landing pages et formulaires créés en quelques secondes pour collecter des leads dès ta première campagne.",
      tag: "Inclus",
    },
  ];

  return (
    <section id="features" style={{ padding: "100px clamp(16px, 5vw, 48px)", background: "#0F0F1A" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Fonctionnalités
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Tout ce dont tu as besoin
            <br />
            <span style={{ color: "#7B74E8" }}>pour être visible en ligne</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {features.map((f, i) => (
            <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.07}s` }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  height: "100%",
                  transition: "border-color .2s",
                  position: "relative",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(91,84,214,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 18,
                    right: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 5,
                    background:
                      f.tag === "Pro"
                        ? "linear-gradient(135deg, #5B54D6, #C026D3)"
                        : "rgba(91,84,214,0.15)",
                    color: f.tag === "Pro" ? "white" : "#7B74E8",
                    letterSpacing: "0.06em",
                  }}
                >
                  {f.tag}
                </span>

                <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "white", marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      initial: "S",
      gradient: "linear-gradient(135deg, #5B54D6, #C026D3)",
      name: "Sophie M.",
      role: "Gérante de restaurant, Lyon",
      text: "En 10 minutes j'avais une campagne Instagram complète pour mon menu du week-end. Avant je passais 2h sur Canva pour un résultat moins pro. GrowIQ a changé ma façon de travailler.",
    },
    {
      initial: "T",
      gradient: "linear-gradient(135deg, #06B6D4, #5B54D6)",
      name: "Thomas R.",
      role: "Coach business indépendant, Paris",
      text: "J'ai lancé 3 campagnes LinkedIn en une semaine sans toucher à un seul outil de design. Le ton est parfait, les textes sont meilleurs que ce que j'écrivais moi-même. Je recommande à tous les indépendants.",
    },
    {
      initial: "C",
      gradient: "linear-gradient(135deg, #C026D3, #7B74E8)",
      name: "Camille D.",
      role: "Fondatrice boutique e-commerce, Bordeaux",
      text: "Ce qui m'a convaincue c'est que tout est en français et que l'agent comprend vraiment mon secteur. Ma dernière campagne email a fait 38% de taux d'ouverture. Je suis bluffée.",
    },
  ];

  return (
    <section id="testimonials" style={{ padding: "100px clamp(16px, 5vw, 48px)", background: "#0F0F1A" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Ils nous font confiance
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 900,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Ce que nos utilisateurs disent
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
          }}
        >
          {testimonials.map((tm, i) => (
            <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: 28,
                  height: "100%",
                  transition: "border-color .25s ease, transform .25s ease",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(91,84,214,0.35)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: 14,
                    fontSize: 80,
                    lineHeight: 1,
                    fontWeight: 900,
                    color: "rgba(91,84,214,0.15)",
                    pointerEvents: "none",
                  }}
                >
                  &ldquo;
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: tm.gradient,
                      color: "white",
                      fontWeight: 700,
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {tm.initial}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{tm.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{tm.role}</div>
                  </div>
                </div>

                <div
                  aria-label="Note 5 sur 5"
                  style={{ color: "#F59E0B", fontSize: 15, letterSpacing: "0.08em", marginBottom: 14 }}
                >
                  {"\u2605\u2605\u2605\u2605\u2605"}
                </div>

                <p
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontStyle: "italic",
                    position: "relative",
                  }}
                >
                  {tm.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type Stat = { end: number; suffix: string; label: string; prefix?: string; special?: string };

function StatsSection() {
  const [counted, setCounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setCounted(true);
      },
      { threshold: 0.5 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const stats: Stat[] = [
    { end: 10, suffix: "min", label: "pour créer une campagne complète", prefix: "<" },
    { end: 0, suffix: "", label: "pour démarrer, sans engagement", special: "0€" },
    { end: 0, suffix: "", label: "carte bancaire requise", special: "✓ Aucune" },
    { end: 100, suffix: "%", label: "en français, sans jargon" },
  ];

  return (
    <section
      ref={ref}
      style={{
        padding: "80px clamp(16px, 5vw, 48px)",
        background: "linear-gradient(135deg, #08080F 0%, #0F0F1A 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700,
          height: 500,
          background: "radial-gradient(ellipse, rgba(91,84,214,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 48,
        }}
      >
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: "#7B74E8",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginBottom: 8,
                animation: counted ? `countUp .5s ease ${i * 0.15}s both` : "none",
              }}
            >
              {s.special || `${s.prefix || ""}${counted ? s.end : 0}${s.suffix}`}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.45)",
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type Plan = {
  name: string;
  price: string;
  sub: string;
  features: string[];
  cta: string;
  href: string;
  highlight: boolean;
  badge?: string;
};

function PricingSection() {
  const plans: Plan[] = [
    {
      name: "Gratuit",
      price: "0€",
      sub: "Pour démarrer",
      features: [
        "5 campagnes / mois",
        "Posts Facebook, Instagram, LinkedIn",
        "Campagnes email (500 contacts)",
        "Visuels IA basiques",
        "Page de capture intégrée",
        "Support par email",
      ],
      cta: "Commencer gratuitement",
      href: "/app",
      highlight: false,
    },
    {
      name: "Pro",
      price: "29€",
      sub: "/ mois · sans engagement",
      features: [
        "Campagnes illimitées",
        "Publicités Meta Ads & Google Ads",
        "Visuels IA premium",
        "Analytics avancés",
        "Listes email illimitées",
        "Priorité de traitement IA",
        "Support prioritaire",
      ],
      cta: "Démarrer en Pro",
      href: "/app",
      highlight: true,
      badge: "Populaire",
    },
    {
      name: "Business",
      price: "79€",
      sub: "/ mois · multi-comptes",
      features: [
        "Tout le plan Pro",
        "Jusqu'à 5 marques / comptes",
        "Onboarding personnalisé",
        "Intégrations CRM",
        "Account manager dédié",
        "SLA garanti",
      ],
      cta: "Nous contacter",
      href: "mailto:contact@growiq.tech",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" style={{ padding: "100px clamp(16px, 5vw, 48px)", background: "#0F0F1A" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Tarifs
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            Simple et transparent
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)" }}>
            Commence gratuitement. Passe au Pro quand tu veux.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {plans.map((plan, i) => (
            <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div
                style={{
                  background: plan.highlight
                    ? "linear-gradient(135deg, rgba(91,84,214,0.15), rgba(192,38,211,0.08))"
                    : "rgba(255,255,255,0.02)",
                  border: plan.highlight
                    ? "1px solid rgba(91,84,214,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: "32px 28px",
                  position: "relative",
                  transform: plan.highlight ? "scale(1.02)" : "scale(1)",
                  boxShadow: plan.highlight ? "0 0 60px rgba(91,84,214,0.12)" : "none",
                }}
              >
                {plan.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 14px",
                      borderRadius: 20,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <div style={{ marginBottom: 6, fontSize: 16, fontWeight: 700, color: "white" }}>
                  {plan.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 44,
                      fontWeight: 900,
                      letterSpacing: "-0.04em",
                      color: plan.highlight ? "#7B74E8" : "white",
                    }}
                  >
                    {plan.price}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>
                  {plan.sub}
                </div>

                <ul style={{ listStyle: "none", marginBottom: 28, padding: 0 }}>
                  {plan.features.map((f, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.65)",
                        marginBottom: 9,
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: "#5B54D6", flexShrink: 0, fontWeight: 700 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <SmartLink
                  href={plan.href}
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: plan.highlight
                      ? "linear-gradient(135deg, #5B54D6, #C026D3)"
                      : "rgba(255,255,255,0.07)",
                    color: "white",
                    borderRadius: 50,
                    padding: "11px",
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.1)",
                    transition: "opacity .2s",
                    boxShadow: plan.highlight ? "0 6px 20px rgba(91,84,214,0.4)" : "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {plan.cta} →
                </SmartLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    {
      q: "Faut-il s'y connaître en marketing pour utiliser GrowIQ ?",
      a: "Non. L'agent te guide étape par étape avec un langage simple. Tu réponds à quelques questions et il prépare tout pour toi.",
    },
    {
      q: "Sur quels réseaux GrowIQ peut publier ?",
      a: "Facebook, Instagram et LinkedIn pour les publications gratuites. Meta Ads et Google Ads pour les campagnes payantes. L'envoi d'emails est inclus dans tous les plans.",
    },
    {
      q: "GrowIQ est-il vraiment gratuit ?",
      a: "Oui, tu peux démarrer gratuitement et lancer ta première campagne sans carte bancaire. Le plan gratuit inclut 5 campagnes par mois.",
    },
    {
      q: "Mes données sont-elles en sécurité ?",
      a: "Oui. Tes informations restent privées et tu peux effacer toutes tes données en un clic depuis ton espace.",
    },
    {
      q: "Puis-je relire et modifier les contenus avant publication ?",
      a: "Absolument. Tu valides chaque publication avant qu'elle ne soit envoyée. GrowIQ ne publie jamais sans ton accord.",
    },
  ];

  return (
    <section
      id="faq"
      style={{
        padding: "100px clamp(16px, 5vw, 48px)",
        background: "linear-gradient(160deg, #08080F, #0F0F1A)",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            FAQ
          </div>
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Questions fréquentes
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {faqs.map((faq, i) => (
            <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: open === i ? "1px solid rgba(91,84,214,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  overflow: "hidden",
                  transition: "border-color .2s",
                }}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{
                    width: "100%",
                    padding: "18px 22px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: "white", lineHeight: 1.4 }}>
                    {faq.q}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      color: "#5B54D6",
                      flexShrink: 0,
                      marginLeft: 16,
                      transition: "transform .2s",
                      transform: open === i ? "rotate(45deg)" : "rotate(0)",
                    }}
                  >
                    +
                  </span>
                </button>
                {open === i && (
                  <div
                    style={{
                      padding: "0 22px 18px",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.5)",
                      lineHeight: 1.65,
                    }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTAFinalSection() {
  return (
    <section style={{ padding: "100px clamp(16px, 5vw, 48px)", background: "#0F0F1A" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div
          className="reveal"
          style={{
            background: "linear-gradient(135deg, rgba(91,84,214,0.12), rgba(192,38,211,0.06))",
            border: "1px solid rgba(91,84,214,0.25)",
            borderRadius: 28,
            padding: "clamp(48px, 6vw, 80px) clamp(24px, 5vw, 80px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-30%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 500,
              height: 300,
              background: "radial-gradient(ellipse, rgba(91,84,214,0.15) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
            <h2
              style={{
                fontSize: "clamp(26px, 4vw, 44px)",
                fontWeight: 900,
                color: "white",
                letterSpacing: "-0.03em",
                marginBottom: 14,
              }}
            >
              Prêt à lancer ta première campagne ?
            </h2>
            <p
              style={{
                fontSize: 17,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
                maxWidth: 480,
                margin: "0 auto 36px",
              }}
            >
              Rejoins les indépendants et petites entreprises qui gèrent leur marketing sans agence,
              directement avec GrowIQ.
            </p>

            <SmartLink
              href="/app"
              style={{
                background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                color: "white",
                borderRadius: 50,
                padding: "15px 44px",
                fontSize: 17,
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 8px 32px rgba(91,84,214,0.5)",
                transition: "all .25s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 14px 44px rgba(91,84,214,0.65)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(91,84,214,0.5)";
              }}
            >
              ⚡ Lancer gratuitement — sans carte
            </SmartLink>

            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 14 }}>
              Première campagne prête en moins de 10 minutes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: "#08080F" }}>
      <div
        style={{
          height: 1,
          margin: "0 clamp(16px, 5vw, 48px)",
          background: "linear-gradient(to right, transparent, rgba(91,84,214,0.4), transparent)",
        }}
      />

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "48px clamp(16px, 5vw, 48px) 28px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: 48,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #5B54D6, #C026D3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                boxShadow: "0 4px 12px rgba(91,84,214,0.4)",
              }}
            >
              ⚡
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
              Grow
              <span
                style={{
                  background: "linear-gradient(135deg, #7B74E8, #C026D3)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                IQ
              </span>
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.7,
              marginBottom: 20,
              maxWidth: 280,
            }}
          >
            L'agent marketing IA en français. Crée, programme et publie tes campagnes en quelques
            minutes.
          </p>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Produit
          </div>
          {[
            { label: "Fonctionnalités", href: "#features" },
            { label: "Tarifs", href: "#pricing" },
            { label: "Lancer une campagne", href: "/app" },
            { label: "Mon compte", href: "/app" },
          ].map((l) => (
            <SmartLink
              key={l.label}
              href={l.href}
              style={{
                display: "block",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
                textDecoration: "none",
                marginBottom: 8,
                transition: "color .2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#7B74E8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              {l.label}
            </SmartLink>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7B74E8",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Légal
          </div>
          {[
            { label: "Conditions d'utilisation", href: "/terms" },
            { label: "Politique de confidentialité", href: "/privacy" },
            { label: "Google Ads API", href: "/google-ads-api" },
            { label: "Contact", href: "/contact" },
          ].map((l) => (
            <SmartLink
              key={l.label}
              href={l.href}
              style={{
                display: "block",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
                textDecoration: "none",
                marginBottom: 8,
                transition: "color .2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#7B74E8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              {l.label}
            </SmartLink>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
          padding: "16px clamp(16px, 5vw, 48px)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>
          © {new Date().getFullYear()} GrowIQ · growiq.tech · Agent marketing IA en français
        </p>
      </div>
    </footer>
  );
}

export default function HomePage() {
  useScrollReveal();

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#08080F", color: "white" }}>
      <Navbar />
      <HeroSection />
      <AudienceSection />
      <HowSection />
      <FeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTAFinalSection />
      <Footer />
      <EmailCapturePopup />
    </div>
  );
}
