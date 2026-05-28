import { SignIn, SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#f7f5ff] via-background to-[#eef9f3] px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/app`}
      />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#f7f5ff] via-background to-[#eef9f3] px-4 py-10">
      <div className="w-full max-w-[440px] flex flex-col items-center gap-4">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/app`}
        />
        <noscript>
          <p className="text-center text-sm text-[#1e1b4b] bg-white rounded-xl p-4 shadow">
            L'inscription nécessite JavaScript. Active-le ou utilise un autre navigateur.
          </p>
        </noscript>
        <p className="text-center text-xs text-[#6b7280]">
          Si rien ne s'affiche au-dessus, l'inscription est momentanément indisponible.{" "}
          <a href={`${basePath}/sign-in`} className="text-[#5b54d6] font-semibold underline">
            Reviens à la page de connexion
          </a>
          .
        </p>
      </div>
    </div>
  );
}
