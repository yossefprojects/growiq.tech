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

type ChannelStatus = { connected?: boolean };
type IntegrationsStatus = {
  facebook?: ChannelStatus;
  instagram?: ChannelStatus;
  linkedin?: ChannelStatus;
};
type MetaStatus = { facebook?: boolean; instagram?: boolean };

/**
 * Aggregates the per-user connection status of all publishing channels.
 * Used by every "launch / publish" button to block actions when the user
 * has no connected channel at all.
 *
 * Source of truth = `/api/integrations` (per-user, multi-tenant). This covers
 * Facebook / Instagram (OAuth ou token manuel, stockés dans `user_integrations`)
 * et LinkedIn. On OR-e avec `/api/meta/status` (creds admin globaux, legacy) pour
 * ne pas casser le cas admin qui publie via les identifiants partagés.
 */
export function useConnectedChannels(enabled = true): ConnectedChannels {
  const { getToken } = useAuth();

  const auth = async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const integrationsQ = useQuery<IntegrationsStatus>({
    queryKey: ["connected-channels-integrations"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/integrations`, { headers: await auth() });
      if (!r.ok) return {};
      return (await r.json()) as IntegrationsStatus;
    },
    enabled,
    staleTime: 30_000,
  });

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

  // Connexion personnelle (multi-tenant) OU creds admin globaux (legacy fallback).
  const facebook =
    integrationsQ.data?.facebook?.connected === true || metaQ.data?.facebook === true;
  const instagram =
    integrationsQ.data?.instagram?.connected === true || metaQ.data?.instagram === true;
  const linkedin = integrationsQ.data?.linkedin?.connected === true;

  return {
    facebook,
    instagram,
    linkedin,
    hasAny: facebook || instagram || linkedin,
    loading: integrationsQ.isLoading || metaQ.isLoading,
  };
}
