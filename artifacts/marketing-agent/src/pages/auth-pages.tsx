import { SignIn } from "@clerk/react";
import { Redirect } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#f7f5ff] via-background to-[#eef9f3] px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/app`}
      />
    </div>
  );
}

export function SignUpPage() {
  return <Redirect to="/sign-in" replace />;
}
