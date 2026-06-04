import { Link } from "wouter";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight, Check, Search, Settings, BarChart3, ShieldCheck } from "lucide-react";

const USE_CASES = [
  {
    icon: Search,
    title: "Create Search campaigns",
    text: "On behalf of our authenticated users, GrowIQ programmatically creates Google Ads Search campaigns, ad groups, keywords and responsive search ads based on the marketing brief the user provides.",
  },
  {
    icon: Settings,
    title: "Manage existing campaigns",
    text: "Users can pause, resume, update budgets and adjust targeting of their own campaigns directly from the GrowIQ interface. All changes are applied through the Google Ads API to the user's own Google Ads account.",
  },
  {
    icon: BarChart3,
    title: "Report on performance",
    text: "GrowIQ reads metrics (impressions, clicks, cost, conversions) from the user's Google Ads account to display clear, plain-language performance reports inside the app.",
  },
];

const DATA_POINTS = [
  "GrowIQ only accesses the Google Ads account that the user explicitly connects via Google OAuth.",
  "We never access, modify or manage Google Ads accounts without the account owner's authorization.",
  "Access tokens are stored server-side with access controls and are used solely to perform actions the user requested.",
  "Users can disconnect their Google Ads account at any time, which revokes our access.",
];

export default function GoogleAdsApiPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="group" data-testid="link-home">
            <BrandLogo iconSize={34} wordmarkClassName="text-lg" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-foreground text-background hover:opacity-90 rounded-md px-4 py-2 text-sm font-semibold transition-opacity"
            data-testid="header-home"
          >
            Home
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-16 pb-10">
        <p className="text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-400 mb-3">
          Google Ads API — Use Case Description
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
          How GrowIQ uses the Google Ads API
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          GrowIQ is an AI marketing assistant for small businesses, freelancers,
          artisans, shop owners and content creators. It helps non-technical
          users create, launch and manage real marketing campaigns from a single
          conversational interface — including organic social posts, email
          campaigns, and paid advertising on Google Ads.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-3">What is GrowIQ?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          GrowIQ (operated at growiq.tech) is a software-as-a-service marketing
          platform. Each user connects their own advertising and social accounts.
          The platform then acts on the user's behalf to plan and execute
          marketing campaigns, saving them the time and expertise normally
          required to run advertising themselves.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Our users are typically small and medium-sized businesses without a
          dedicated marketing team. They describe their product, audience and
          goal in plain language, and GrowIQ produces ready-to-launch campaigns.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">How we use the Google Ads API</h2>
        <div className="space-y-5">
          {USE_CASES.map((u) => {
            const Icon = u.icon;
            return (
              <div
                key={u.title}
                className="flex gap-4 bg-card border border-border rounded-2xl p-5"
              >
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-md">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{u.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {u.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          <h2 className="text-2xl font-bold">Data access &amp; user authorization</h2>
        </div>
        <ul className="space-y-3">
          {DATA_POINTS.map((d) => (
            <li key={d} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-muted-foreground leading-relaxed">{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-3">Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          For any question regarding our use of the Google Ads API, please
          contact us at{" "}
          <a
            href="mailto:contact@growiq.tech"
            className="text-fuchsia-600 dark:text-fuchsia-400 font-semibold hover:underline"
          >
            contact@growiq.tech
          </a>
          . Our privacy policy is available at{" "}
          <a
            href="https://growiq.tech/privacy"
            className="text-fuchsia-600 dark:text-fuchsia-400 font-semibold hover:underline"
          >
            growiq.tech/privacy
          </a>
          .
        </p>
      </section>

      <footer className="border-t border-border/60 py-8 mt-8">
        <div className="max-w-5xl mx-auto px-6 text-sm text-muted-foreground">
          <span>GrowIQ — {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
