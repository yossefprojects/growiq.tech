import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ConnectedChannels = {
  facebook: boolean;
  instagram: boolean;
  linkedin: boolean;
  hasAny: boolean;
  loading: boolean;
};

type MetaStatus = { facebook?: boolean; instagram?: boolean };
type LinkedinStatus = { configured?: boolean; connected?: boolean };

/**
 * Aggregates the per-user connection status of all publishing channels.
 * Used by every "launch / publish" button to block actions when the user
 * has no connected channel at all.
 *
 * - Meta (Facebook / Instagram) status is server-side gated to admins.
 * - LinkedIn is per-user OAuth.
 */
export function useConnectedChannels(enabled = true): ConnectedChannels {
  const { getToken } = useAuth();

  const auth = async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const metaQ = useQuery<MetaStatus>({
    queryKey: ["meta-status"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/meta/status`, { headers: await auth() });
      if (!r.ok) return {};
      return (await r.json()) as MetaStatus;
    },
    enabled,
    staleTime: 30_000,
  });

  const linkedinQ = useQuery<LinkedinStatus>({
    queryKey: ["linkedin-status"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/linkedin/status`, { headers: await auth() });
      if (!r.ok) return {};
      return (await r.json()) as LinkedinStatus;
    },
    enabled,
    staleTime: 30_000,
  });

  const facebook = metaQ.data?.facebook === true;
  const instagram = metaQ.data?.instagram === true;
  const linkedin = linkedinQ.data?.connected === true;

  return {
    facebook,
    instagram,
    linkedin,
    hasAny: facebook || instagram || linkedin,
    loading: metaQ.isLoading || linkedinQ.isLoading,
  };
}
