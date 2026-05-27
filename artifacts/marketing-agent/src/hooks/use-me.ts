import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Me = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

/**
 * Returns the authenticated user with their admin flag.
 * Cache key is scoped to the Clerk userId so switching accounts can't
 * leak the previous user's role into the UI.
 */
export function useMe(): { data: Me | null; isLoading: boolean; isAdmin: boolean } {
  const { getToken, userId } = useAuth();

  const q = useQuery<Me | null>({
    queryKey: ["me", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${basePath}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) return null;
      return (await r.json()) as Me;
    },
  });

  return {
    data: q.data ?? null,
    isLoading: q.isLoading,
    isAdmin: q.data?.isAdmin === true,
  };
}
