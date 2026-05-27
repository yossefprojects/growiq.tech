import { Link } from "wouter";
import { Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useIsAdmin(): boolean {
  const { getToken } = useAuth();
  const { data } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["me"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${basePath}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  return !!data?.isAdmin;
}

/**
 * Compact circular admin icon button. Renders nothing for non-admins.
 * variant="solid" → filled badge (dashboard).
 * variant="ghost" → subtle outline (mobile header / sidebar header).
 */
export function AdminIconButton({
  variant = "ghost",
  className,
}: {
  variant?: "solid" | "ghost";
  className?: string;
}) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  return (
    <Link
      href="/app/admin"
      title="Admin CRM"
      aria-label="Admin CRM"
      data-testid="button-admin"
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors shrink-0",
        variant === "solid"
          ? "w-10 h-10 bg-[#5b54d6] text-white hover:bg-[#4a44c4] shadow-md"
          : "w-9 h-9 border border-[#5b54d6]/40 text-[#5b54d6] hover:bg-[#5b54d6]/10",
        className,
      )}
    >
      <Shield className={variant === "solid" ? "w-5 h-5" : "w-4 h-4"} />
    </Link>
  );
}
