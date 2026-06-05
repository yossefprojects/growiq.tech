import { Link } from "wouter";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <header className="px-6 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-2 group" data-testid="link-home-404">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-violet-700 to-blue-700 bg-clip-text text-transparent">
            GrowIQ
          </span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-7xl font-extrabold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-4">
            404
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Cette page n'existe pas
          </h1>
          <p className="text-muted-foreground mb-6">
            Le lien que tu as suivi est peut-être cassé ou la page a été déplacée.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:opacity-90 rounded-md px-5 py-2.5 text-sm font-semibold transition-opacity shadow-lg shadow-violet-500/30"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
