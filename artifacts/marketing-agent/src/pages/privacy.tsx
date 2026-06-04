import { Link } from "wouter";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Qui sommes-nous",
    body: [
      "GrowIQ (accessible sur growiq.tech) est un assistant marketing basé sur l'intelligence artificielle, destiné aux indépendants, artisans, commerçants, créateurs de contenu et petites entreprises. GrowIQ aide ses utilisateurs à créer, programmer et publier des campagnes marketing.",
    ],
  },
  {
    title: "2. Données que nous collectons",
    body: [
      "Informations de compte : ton adresse email et ton identifiant de connexion, gérés via notre prestataire d'authentification.",
      "Informations de profil business : le secteur, la cible et les objectifs que tu renseignes pour personnaliser tes campagnes.",
      "Comptes connectés : lorsque tu connectes un compte (Facebook, Instagram, LinkedIn, Google Ads, Resend), nous stockons les jetons d'accès nécessaires pour agir en ton nom, uniquement pour les actions que tu demandes.",
      "Contenu généré : les campagnes, emails, posts et contacts que tu crées dans l'application.",
    ],
  },
  {
    title: "3. Comment nous utilisons tes données",
    body: [
      "Nous utilisons tes données uniquement pour fournir le service : générer des campagnes, publier sur tes comptes connectés, envoyer tes emails et afficher tes statistiques.",
      "Nous n'accédons jamais à tes comptes connectés sans ton autorisation explicite, et seulement pour réaliser les actions que tu as demandées.",
      "Nous ne vendons pas tes données personnelles à des tiers.",
    ],
  },
  {
    title: "4. Partage avec des tiers",
    body: [
      "Tes données peuvent transiter par des prestataires techniques nécessaires au fonctionnement du service : plateformes publicitaires et sociales (Meta, Google Ads, LinkedIn), service d'envoi d'emails (Resend), hébergement et fournisseurs d'IA. Chacun ne reçoit que les données strictement nécessaires.",
    ],
  },
  {
    title: "5. Conservation et sécurité",
    body: [
      "Tes jetons d'accès sont conservés sur nos serveurs avec des contrôles d'accès, et utilisés uniquement pour les actions que tu demandes.",
      "Tu peux déconnecter un compte à tout moment, ce qui révoque notre accès à ce compte.",
      "Tu peux effacer toutes tes données (profil business, conversations, posts programmés, pages de capture, leads, campagnes, données SEO) depuis ton espace, en un clic. Cette action est irréversible. Ton compte de connexion reste actif tant que tu ne demandes pas sa suppression.",
    ],
  },
  {
    title: "6. Tes droits",
    body: [
      "Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, de suppression et de portabilité de tes données. Pour exercer ces droits, contacte-nous.",
    ],
  },
  {
    title: "7. Contact",
    body: [
      "Pour toute question relative à cette politique de confidentialité ou à tes données, écris-nous à contact@growiq.tech.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="group" data-testid="link-home">
            <BrandLogo iconSize={34} wordmarkClassName="text-lg" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-foreground text-background hover:opacity-90 rounded-md px-4 py-2 text-sm font-semibold transition-opacity"
            data-testid="header-home"
          >
            Accueil
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-16 pb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16 space-y-10">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h2 className="text-2xl font-bold mb-3">{s.title}</h2>
            <div className="space-y-3">
              {s.body.map((p, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="max-w-3xl mx-auto px-6 text-sm text-muted-foreground">
          <span>GrowIQ — {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
