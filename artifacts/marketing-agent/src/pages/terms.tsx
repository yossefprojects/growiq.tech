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
    title: "2. Mentions légales",
    body: [
      "Éditeur : GrowIQ — contact@growiq.tech",
      "Hébergement : Replit, Inc. — 675 Berry Street, San Francisco, CA 94107, USA (replit.com).",
      "Directeur de la publication : Joseph Chaouat.",
    ],
  },
  {
    title: "3. Description du service",
    body: [
      "GrowIQ est un assistant marketing propulsé par l'intelligence artificielle. Il aide ses utilisateurs à créer, programmer et publier des campagnes marketing sur différentes plateformes (réseaux sociaux, email, publicité en ligne).",
      "GrowIQ agit en tant qu'outil technique d'automatisation. Il ne se substitue ni à un conseil en marketing, ni à une agence de publicité, ni à un conseil juridique ou financier.",
    ],
  },
  {
    title: "4. Campagnes publicitaires payantes — Limitation de responsabilité",
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
    title: "5. Emailing — Responsabilité anti-spam et RGPD",
    body: [
      "GrowIQ permet d'envoyer des campagnes d'emailing via le service d'envoi connecté par l'utilisateur (Resend ou autre).",
      "L'utilisateur garantit qu'il dispose du consentement explicite et préalable de chaque destinataire conformément au Règlement Général sur la Protection des Données (RGPD), à la directive ePrivacy, et à toute législation anti-spam applicable (notamment la loi française « Informatique et Libertés »).",
      "L'utilisateur s'engage à ne pas utiliser GrowIQ pour envoyer des communications non sollicitées (spam), trompeuses, frauduleuses, ou portant atteinte aux droits de tiers.",
      "L'utilisateur est seul responsable du contenu de ses emails, de la gestion de ses listes de contacts, du respect des demandes de désinscription, et de la conformité de ses envois avec les lois applicables.",
      "GrowIQ met à disposition un lien de désinscription automatique dans chaque email envoyé. L'utilisateur s'engage à ne pas le supprimer, le masquer ou le contourner.",
      "GrowIQ décline toute responsabilité en cas de plainte, signalement, blacklistage, ou sanction liée à l'envoi d'emails non conformes par l'utilisateur.",
    ],
  },
  {
    title: "6. Publication sur les réseaux sociaux",
    body: [
      "GrowIQ permet de créer, programmer et publier des contenus sur les comptes de réseaux sociaux connectés par l'utilisateur (Facebook, Instagram, LinkedIn).",
      "L'utilisateur est seul responsable du contenu publié sur ses comptes, y compris les textes, images et légendes générés par l'IA qu'il choisit de valider et publier.",
      "GrowIQ ne contrôle pas et ne modère pas les contenus publiés. L'utilisateur s'engage à ne pas publier de contenus illicites, diffamatoires, discriminatoires, trompeurs, ou portant atteinte aux droits de tiers (propriété intellectuelle, droit à l'image, vie privée).",
      "GrowIQ décline toute responsabilité en cas de suppression de contenu, suspension de compte, ou sanction imposée par une plateforme tierce suite à une publication effectuée via GrowIQ.",
    ],
  },
  {
    title: "7. Contenus générés par IA",
    body: [
      "GrowIQ utilise des modèles d'intelligence artificielle pour générer des textes, des suggestions de mots-clés, des plans de campagne et d'autres contenus marketing.",
      "Ces contenus sont fournis à titre indicatif et de suggestion. GrowIQ ne garantit pas leur exactitude, leur pertinence, leur conformité légale ou réglementaire, ni leur adéquation à un objectif particulier.",
      "Les contenus générés par IA peuvent contenir des erreurs, des inexactitudes ou des formulations inadaptées. L'utilisateur est seul responsable de la vérification et de la validation de tout contenu avant publication ou diffusion.",
      "GrowIQ ne saurait être tenu responsable de tout préjudice résultant de l'utilisation de contenus générés par IA sans vérification préalable par l'utilisateur.",
    ],
  },
  {
    title: "8. Comptes connectés et dépendance aux services tiers",
    body: [
      "L'utilisateur connecte ses propres comptes sur les plateformes tierces (Facebook, Instagram, LinkedIn, Google Ads, Resend). GrowIQ agit en son nom, uniquement pour les actions demandées.",
      "L'utilisateur peut déconnecter ses comptes à tout moment, ce qui révoque immédiatement l'accès de GrowIQ.",
      "GrowIQ dépend d'API et de services fournis par des tiers (Meta, Google, LinkedIn, OpenAI, Resend, Clerk, etc.). GrowIQ ne saurait être tenu responsable des modifications, interruptions, limitations ou suppressions apportées par ces tiers à leurs services, API, conditions d'utilisation ou politiques.",
      "En cas d'indisponibilité d'un service tiers, GrowIQ n'est pas tenu de fournir une solution de remplacement ni de compenser les pertes résultant de cette indisponibilité.",
    ],
  },
  {
    title: "9. Disponibilité du service",
    body: [
      "GrowIQ s'efforce d'assurer une disponibilité continue du service, mais ne garantit pas un fonctionnement ininterrompu, exempt d'erreurs ou de dysfonctionnements.",
      "GrowIQ peut procéder à des opérations de maintenance, des mises à jour ou des modifications du service, pouvant entraîner des interruptions temporaires sans préavis ni indemnisation.",
      "GrowIQ ne garantit aucun niveau de service (SLA) et décline toute responsabilité en cas d'indisponibilité, de lenteur ou de perte de données.",
    ],
  },
  {
    title: "10. Limitation générale de responsabilité",
    body: [
      "GrowIQ est fourni « en l'état » (as is) et « selon disponibilité » (as available). Dans les limites autorisées par la loi applicable, GrowIQ exclut toute garantie, expresse ou implicite, y compris mais sans s'y limiter les garanties de qualité marchande, d'adéquation à un usage particulier et d'absence de contrefaçon.",
      "En aucun cas GrowIQ, ses dirigeants, employés ou partenaires ne pourront être tenus responsables de tout dommage indirect, accessoire, spécial, consécutif ou punitif, y compris mais sans s'y limiter la perte de profits, de données, de clientèle, d'opportunités commerciales ou de chiffre d'affaires.",
      "La responsabilité totale de GrowIQ, toutes causes confondues, est limitée au montant effectivement payé par l'utilisateur à GrowIQ au cours des 12 mois précédant l'événement donnant lieu à la réclamation, ou à 50 € si aucun montant n'a été payé.",
    ],
  },
  {
    title: "11. Indemnisation",
    body: [
      "L'utilisateur s'engage à indemniser, défendre et dégager de toute responsabilité GrowIQ, ses dirigeants, employés et partenaires, contre toute réclamation, demande, action, perte, dommage, coût ou dépense (y compris les frais d'avocat) résultant de :",
      "• L'utilisation du service par l'utilisateur en violation des présentes CGU ;",
      "• Le contenu publié, diffusé ou envoyé par l'utilisateur via GrowIQ ;",
      "• La violation par l'utilisateur de toute loi, réglementation ou droit de tiers ;",
      "• L'envoi d'emails non conformes ou non sollicités via GrowIQ ;",
      "• Les campagnes publicitaires créées ou activées par l'utilisateur.",
    ],
  },
  {
    title: "12. Obligations de l'utilisateur",
    body: [
      "L'utilisateur s'engage à utiliser GrowIQ conformément aux lois et réglementations applicables, y compris les lois sur la publicité, la protection des données (RGPD), la propriété intellectuelle, et les conditions d'utilisation des plateformes tierces.",
      "L'utilisateur est seul responsable du contenu qu'il publie, envoie ou diffuse via GrowIQ, y compris les contenus générés par IA qu'il choisit de valider.",
      "L'utilisateur s'engage à ne pas utiliser GrowIQ pour diffuser des contenus illicites, trompeurs, diffamatoires, discriminatoires, ou portant atteinte aux droits de tiers.",
      "L'utilisateur s'engage à ne pas tenter de contourner les mesures de sécurité, d'accéder aux comptes d'autres utilisateurs, ou d'utiliser le service de manière abusive.",
    ],
  },
  {
    title: "13. Suspension et résiliation",
    body: [
      "GrowIQ se réserve le droit de suspendre ou résilier l'accès d'un utilisateur, sans préavis ni indemnisation, en cas de :",
      "• Violation des présentes CGU ;",
      "• Utilisation abusive, frauduleuse ou illicite du service ;",
      "• Envoi de spam ou de communications non conformes ;",
      "• Non-paiement des sommes dues (le cas échéant) ;",
      "• Demande d'une autorité judiciaire ou administrative.",
      "L'utilisateur peut résilier son compte à tout moment en supprimant ses données depuis son espace ou en contactant contact@growiq.tech.",
    ],
  },
  {
    title: "14. Propriété intellectuelle",
    body: [
      "Les contenus générés par GrowIQ (textes, suggestions, visuels) peuvent être librement utilisés par l'utilisateur dans le cadre de ses activités marketing.",
      "La plateforme GrowIQ, son code source, son design, ses algorithmes et sa marque restent la propriété exclusive de GrowIQ. Toute reproduction, copie, modification ou distribution non autorisée est interdite.",
    ],
  },
  {
    title: "15. Force majeure",
    body: [
      "GrowIQ ne saurait être tenu responsable de tout retard ou manquement dans l'exécution de ses obligations résultant d'un événement de force majeure, y compris mais sans s'y limiter : catastrophe naturelle, pandémie, panne d'infrastructure, cyberattaque, modification législative ou réglementaire, indisponibilité de services tiers, ou tout autre événement imprévisible, irrésistible et extérieur.",
    ],
  },
  {
    title: "16. Modification des CGU",
    body: [
      "GrowIQ se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication sur la plateforme. L'utilisation continue du service après modification vaut acceptation des nouvelles CGU.",
      "En cas de modification substantielle, GrowIQ s'efforcera d'en informer les utilisateurs par email ou notification dans l'application.",
    ],
  },
  {
    title: "17. Droit applicable et juridiction",
    body: [
      "Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux de Paris, France.",
      "En cas de litige, l'utilisateur s'engage à tenter une résolution amiable avant toute action judiciaire, en contactant GrowIQ à contact@growiq.tech.",
    ],
  },
  {
    title: "18. Divisibilité",
    body: [
      "Si une clause des présentes CGU est déclarée nulle ou inapplicable par un tribunal compétent, les autres clauses restent pleinement en vigueur et de plein effet.",
    ],
  },
  {
    title: "19. Contact",
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
