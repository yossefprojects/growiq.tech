import { Link } from "wouter";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Objet",
    body: [
      "Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de la plateforme GrowIQ (accessible sur growiq.tech), éditée par GrowIQ. En créant un compte ou en utilisant le service, tu acceptes sans réserve l'intégralité des présentes CGU.",
    ],
  },
  {
    title: "2. Description du service",
    body: [
      "GrowIQ est un assistant marketing propulsé par l'intelligence artificielle. Il aide ses utilisateurs à créer, programmer et publier des campagnes marketing sur différentes plateformes (réseaux sociaux, email, publicité en ligne).",
      "GrowIQ agit en tant qu'outil technique d'automatisation. Il ne se substitue ni à un conseil en marketing, ni à une agence de publicité, ni à un conseil juridique ou financier.",
    ],
  },
  {
    title: "3. Campagnes publicitaires payantes — Limitation de responsabilité",
    body: [
      "GrowIQ permet de créer et lancer des campagnes publicitaires payantes sur des plateformes tierces (Google Ads, Meta Ads, etc.) via les comptes publicitaires de l'utilisateur.",
      "L'utilisateur reconnaît et accepte que :",
      "• Les campagnes sont créées sur le compte publicitaire personnel de l'utilisateur. GrowIQ ne détient ni ne gère les budgets publicitaires — les dépenses sont directement facturées par la plateforme tierce (Google, Meta, etc.) à l'utilisateur.",
      "• GrowIQ ne garantit aucun résultat, performance, nombre de clics, impressions, conversions, ventes, ou retour sur investissement (ROI) des campagnes créées via la plateforme.",
      "• Les contenus publicitaires (titres, descriptions, mots-clés) sont générés par intelligence artificielle à titre de suggestion. L'utilisateur est seul responsable de la validation, de la pertinence et de la conformité de ces contenus avant leur mise en ligne.",
      "• Toutes les campagnes sont créées en statut « En pause ». L'activation d'une campagne — et donc l'engagement de dépenses publicitaires — relève de la décision exclusive de l'utilisateur.",
      "• GrowIQ décline toute responsabilité en cas de campagnes non performantes, de dépenses publicitaires jugées excessives, de refus ou suspension de campagne par la plateforme tierce, ou de tout préjudice direct ou indirect lié à l'utilisation des fonctionnalités publicitaires.",
      "• L'utilisateur s'engage à respecter les conditions d'utilisation et les politiques publicitaires des plateformes tierces (Google Ads, Meta, etc.).",
    ],
  },
  {
    title: "4. Contenus générés par IA",
    body: [
      "GrowIQ utilise des modèles d'intelligence artificielle pour générer des textes, des suggestions de mots-clés, des plans de campagne et d'autres contenus marketing.",
      "Ces contenus sont fournis à titre indicatif et de suggestion. GrowIQ ne garantit pas leur exactitude, leur pertinence, leur conformité légale ou réglementaire, ni leur adéquation à un objectif particulier.",
      "L'utilisateur est seul responsable de la vérification et de la validation de tout contenu avant publication ou diffusion.",
    ],
  },
  {
    title: "5. Comptes connectés et données",
    body: [
      "L'utilisateur connecte ses propres comptes sur les plateformes tierces (Facebook, Instagram, LinkedIn, Google Ads, Resend). GrowIQ agit en son nom, uniquement pour les actions demandées.",
      "L'utilisateur peut déconnecter ses comptes à tout moment, ce qui révoque immédiatement l'accès de GrowIQ.",
      "GrowIQ ne saurait être tenu responsable des modifications apportées par les plateformes tierces à leurs API, conditions d'utilisation ou fonctionnalités, ni des interruptions de service qui en résulteraient.",
    ],
  },
  {
    title: "6. Limitation générale de responsabilité",
    body: [
      "GrowIQ est fourni « en l'état » (as is). Dans les limites autorisées par la loi applicable, GrowIQ exclut toute garantie, expresse ou implicite, y compris mais sans s'y limiter les garanties de qualité marchande, d'adéquation à un usage particulier et d'absence de contrefaçon.",
      "En aucun cas GrowIQ, ses dirigeants, employés ou partenaires ne pourront être tenus responsables de tout dommage indirect, accessoire, spécial, consécutif ou punitif, y compris mais sans s'y limiter la perte de profits, de données, de clientèle ou d'opportunités commerciales.",
      "La responsabilité totale de GrowIQ, toutes causes confondues, est limitée au montant effectivement payé par l'utilisateur à GrowIQ au cours des 12 mois précédant l'événement donnant lieu à la réclamation.",
    ],
  },
  {
    title: "7. Obligations de l'utilisateur",
    body: [
      "L'utilisateur s'engage à utiliser GrowIQ conformément aux lois et réglementations applicables, y compris les lois sur la publicité, la protection des données (RGPD), et les conditions d'utilisation des plateformes tierces.",
      "L'utilisateur est seul responsable du contenu qu'il publie via GrowIQ, y compris les contenus générés par IA qu'il choisit de valider et diffuser.",
      "L'utilisateur s'engage à ne pas utiliser GrowIQ pour diffuser des contenus illicites, trompeurs, diffamatoires ou portant atteinte aux droits de tiers.",
    ],
  },
  {
    title: "8. Propriété intellectuelle",
    body: [
      "Les contenus générés par GrowIQ (textes, suggestions, visuels) peuvent être librement utilisés par l'utilisateur dans le cadre de ses activités marketing.",
      "La plateforme GrowIQ, son code source, son design et sa marque restent la propriété exclusive de GrowIQ.",
    ],
  },
  {
    title: "9. Modification des CGU",
    body: [
      "GrowIQ se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication sur la plateforme. L'utilisation continue du service après modification vaut acceptation des nouvelles CGU.",
    ],
  },
  {
    title: "10. Droit applicable et juridiction",
    body: [
      "Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux de Paris, France.",
    ],
  },
  {
    title: "11. Contact",
    body: [
      "Pour toute question relative aux présentes CGU, contacte-nous à contact@growiq.tech.",
    ],
  },
];

export default function TermsPage() {
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
          Conditions Générales d'Utilisation
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
        <div className="max-w-3xl mx-auto px-6 flex gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Politique de confidentialité</Link>
          <span>GrowIQ — {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
