import { SignIn, SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#08080F] bg-[radial-gradient(circle_at_50%_0%,rgba(91,84,214,0.18),transparent_60%)] px-4 py-10">
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#08080F] bg-[radial-gradient(circle_at_50%_0%,rgba(91,84,214,0.18),transparent_60%)] px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/app`}
      />
    </div>
  );
}
