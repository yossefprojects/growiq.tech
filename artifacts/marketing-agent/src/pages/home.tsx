import { Link } from "wouter";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";
import {
  Sparkles,
  Rocket,
  Image as ImageIcon,
  CalendarClock,
  Mail,
  Target,
  Wrench,
  ArrowRight,
  Check,
  Zap,
  Bot,
  Globe,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Stratège marketing senior",
    description: "Une IA experte en marketing digital, traditionnel, relationnel et d'influence. Disponible 24/7, répond en français.",
    accent: "from-fuchsia-500 to-purple-600",
  },
  {
    icon: Rocket,
    title: "Campagnes complètes en 1 clic",
    description: "SEO, réseaux sociaux, email, local, influence… 7 types de campagnes avec livrables prêts à l'emploi.",
    accent: "from-orange-500 to-pink-600",
  },
  {
    icon: ImageIcon,
    title: "Visuels générés par IA",
    description: "Bannières, posts Instagram, visuels de pub — créés sur mesure pour chaque campagne en quelques secondes.",
    accent: "from-cyan-500 to-blue-600",
  },
  {
    icon: CalendarClock,
    title: "Programmation automatique",
    description: "Planifiez vos posts et emails sur plusieurs jours. Le système les publie tout seul au bon moment.",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    icon: Mail,
    title: "Envoi d'emails réels",
    description: "Newsletters, relances, annonces — vraiment envoyés à vos contacts via Resend, immédiatement ou programmés.",
    accent: "from-rose-500 to-red-600",
  },
  {
    icon: Target,
    title: "Pages de capture de leads",
    description: "Créez en 2 minutes une page publique pour collecter des inscriptions. Anti-spam intégré.",
    accent: "from-violet-500 to-indigo-600",
  },
  {
    icon: Wrench,
    title: "Boîte à outils centralisée",
    description: "Vos leads, pages de capture, publications programmées — tout au même endroit. Export CSV en 1 clic.",
    accent: "from-amber-500 to-orange-600",
  },
];

const BENEFITS = [
  "Aucune carte bancaire requise",
  "Réponses en temps réel (streaming)",
  "Historique de conversations sauvegardé",
  "Adapté à votre secteur d'activité",
];

const STEPS = [
  {
    num: "01",
    title: "Décrivez votre business",
    text: "Secteur, cible, ton de voix, objectifs — l'agent retient tout pour personnaliser chaque réponse.",
  },
  {
    num: "02",
    title: "Lancez une campagne",
    text: "Choisissez un type, validez le brief, recevez une stratégie complète avec visuels et textes prêts.",
  },
  {
    num: "03",
    title: "Exécutez en 1 clic",
    text: "Envoyez les emails, programmez les posts, collectez les leads sur vos pages dédiées.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="group" data-testid="link-home">
            <BrandLogo iconSize={34} wordmarkClassName="text-lg" />
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 bg-foreground text-background hover:opacity-90 rounded-md px-4 py-2 text-sm font-semibold transition-opacity"
            data-testid="header-cta"
          >
            Ouvrir l'app
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-fuchsia-500/20 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 border border-fuchsia-500/20"
          >
            <Zap className="w-3.5 h-3.5" />
            Stratège marketing senior, disponible 24/7
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            Votre <span className="bg-gradient-to-r from-fuchsia-500 to-purple-600 bg-clip-text text-transparent">agent marketing IA</span><br />
            qui exécute, pas qui conseille.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Lancez de vraies campagnes marketing en quelques minutes. Visuels IA, emails envoyés, posts programmés, leads capturés — tout depuis une conversation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
          >
            <Link
              href="/app"
              className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white rounded-xl px-6 py-3.5 text-base font-semibold shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 hover:scale-105 transition-all"
              data-testid="hero-cta-primary"
            >
              <Rocket className="w-5 h-5" />
              Lancer ma première campagne
            </Link>
            <Link
              href="/app"
              className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl px-6 py-3.5 text-base font-medium transition-colors"
              data-testid="hero-cta-secondary"
            >
              <Bot className="w-5 h-5" />
              Parler à l'agent
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                {b}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            7 capacités pour exécuter vos campagnes
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Pas juste des conseils. L'agent crée, publie, envoie et collecte — vraiment.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group relative bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div
                  className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-md mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="bg-gradient-to-br from-fuchsia-500/5 via-purple-500/5 to-transparent border-y border-border/60 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              3 étapes, zéro friction
            </h2>
            <p className="text-muted-foreground">De l'idée à la campagne publiée en moins de 10 minutes.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-bold bg-gradient-to-br from-fuchsia-500/30 to-purple-600/10 bg-clip-text text-transparent mb-2">
                  {s.num}
                </div>
                <h3 className="font-bold text-xl mb-2">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden bg-gradient-to-br from-fuchsia-500 to-purple-700 rounded-3xl p-10 md:p-14 shadow-2xl shadow-fuchsia-500/20"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="relative">
            <Globe className="w-12 h-12 text-white/80 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Prêt à automatiser votre marketing ?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Démarrez gratuitement. Sans carte bancaire. Première campagne en moins de 5 minutes.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 bg-white text-purple-700 rounded-xl px-8 py-4 text-base font-bold shadow-xl hover:scale-105 transition-transform"
              data-testid="footer-cta"
            >
              <Rocket className="w-5 h-5" />
              Commencer maintenant
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span>GrowIQ — {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app" className="hover:text-foreground transition-colors">
              Accéder à l'app
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
