import { SignOutButton } from "@clerk/react";
import { BrandLogo } from "@/components/brand-logo";

export default function AccessPendingPage({ email }: { email?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#ede9fe] via-white to-[#d1fae5]/60 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#ede9fe] p-8 text-center">
        <div className="flex justify-center mb-4">
          <BrandLogo iconSize={48} wordmarkClassName="text-2xl" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#1e1b4b] mb-3">
          Bêta fermée
        </h1>
        <p className="text-[#4b5563] text-sm leading-relaxed mb-2">
          Merci de ton intérêt pour GrowIQ. L'accès est actuellement réservé
          aux comptes invités.
        </p>
        {email ? (
          <p className="text-xs text-[#6b7280] mb-6">
            Tu es connecté avec <span className="font-semibold">{email}</span>.
          </p>
        ) : (
          <div className="mb-6" />
        )}
        <p className="text-sm text-[#4b5563] mb-6">
          Écris-nous pour rejoindre la liste d'attente, on te recontacte dès
          qu'une place se libère.
        </p>
        <SignOutButton redirectUrl="/">
          <button
            className="w-full bg-[#5b54d6] hover:bg-[#4a44b8] text-white font-semibold rounded-lg h-11 transition-colors"
            data-testid="button-signout"
          >
            Se déconnecter
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
