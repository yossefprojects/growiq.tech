/**
 * Google Ads REST API wrapper — Search campaigns.
 *
 * Requires (all 6 secrets must be set):
 *   - GOOGLE_ADS_DEVELOPER_TOKEN    (approved by Google — 2-6 week process)
 *   - GOOGLE_ADS_CLIENT_ID          (OAuth client from Google Cloud Console)
 *   - GOOGLE_ADS_CLIENT_SECRET      (same OAuth client)
 *   - GOOGLE_ADS_REFRESH_TOKEN      (obtained once via OAuth playground)
 *   - GOOGLE_ADS_CUSTOMER_ID        (10-digit, no dashes — the ad account)
 *   - GOOGLE_ADS_LOGIN_CUSTOMER_ID  (optional — MCC manager account id)
 *
 * The Google Ads API uses short-lived OAuth access tokens. We refresh on
 * demand and cache the result in-memory.
 */
import { logger } from "./logger";

const API_VERSION = "v18";
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

function getConfig() {
  return {
    developerToken: process.env["GOOGLE_ADS_DEVELOPER_TOKEN"],
    clientId: process.env["GOOGLE_ADS_CLIENT_ID"],
    clientSecret: process.env["GOOGLE_ADS_CLIENT_SECRET"],
    refreshToken: process.env["GOOGLE_ADS_REFRESH_TOKEN"],
    customerId: process.env["GOOGLE_ADS_CUSTOMER_ID"],
    loginCustomerId: process.env["GOOGLE_ADS_LOGIN_CUSTOMER_ID"],
  };
}

export function isGoogleAdsConfigured(): { configured: boolean; missing: string[] } {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.developerToken) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!c.clientId) missing.push("GOOGLE_ADS_CLIENT_ID");
  if (!c.clientSecret) missing.push("GOOGLE_ADS_CLIENT_SECRET");
  if (!c.refreshToken) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
  if (!c.customerId) missing.push("GOOGLE_ADS_CUSTOMER_ID");
  return { configured: missing.length === 0, missing };
}

// In-memory OAuth token cache. Tokens last 1h; we refresh 5 min before expiry.
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (cachedAccessToken && cachedAccessToken.expiresAt - 5 * 60_000 > Date.now()) {
    return { ok: true, token: cachedAccessToken.token };
  }
  const { clientId, clientSecret, refreshToken } = getConfig();
  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, error: "OAuth credentials Google manquants" };
  }
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return { ok: true, token: data.access_token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "OAuth refresh failed" };
  }
}

async function adsFetch(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const { developerToken, customerId, loginCustomerId } = getConfig();
  if (!developerToken || !customerId) {
    return { ok: false, error: "Configuration Google Ads incomplète" };
  }
  const token = await getAccessToken();
  if (!token.ok) return { ok: false, error: token.error };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.token}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  try {
    const res = await fetch(`${API_BASE}/customers/${customerId}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const errMsg =
        ((data["error"] as { message?: string } | undefined)?.message) ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export type GoogleAdsLaunchInput = {
  campaignName: string;
  /** Daily budget in cents in the ad account's currency. */
  dailyBudgetCents: number;
  /** Where clicks go. */
  finalUrl: string;
  /** Up to 15 headlines, each ≤ 30 chars (Google Responsive Search Ads rules). */
  headlines: string[];
  /** Up to 4 descriptions, each ≤ 90 chars. */
  descriptions: string[];
  /** Keywords to target (broad match by default). */
  keywords: string[];
};

export type GoogleAdsLaunchResult =
  | {
      success: true;
      campaignResource: string;
      adGroupResource: string;
      budgetResource: string;
    }
  | { success: false; error: string; configMissing?: boolean };

/**
 * Launch a Search campaign — created PAUSED so the operator can verify before
 * spending real money. Requires 4 sequential mutate calls (budget → campaign
 * → ad group → ad + keywords). We bail out on the first error; partial
 * cleanup is best-effort.
 */
export async function launchGoogleSearchCampaign(
  input: GoogleAdsLaunchInput,
): Promise<GoogleAdsLaunchResult> {
  const check = isGoogleAdsConfigured();
  if (!check.configured) {
    return {
      success: false,
      error: `Google Ads pas encore configuré (manque : ${check.missing.join(", ")})`,
      configMissing: true,
    };
  }
  if (input.headlines.length < 3) {
    return { success: false, error: "Google Ads exige au moins 3 titres" };
  }
  if (input.descriptions.length < 2) {
    return { success: false, error: "Google Ads exige au moins 2 descriptions" };
  }

  // 1. Campaign budget (micros = currency * 1_000_000; we have cents, so * 10_000)
  const budgetMicros = input.dailyBudgetCents * 10_000;
  const budgetRes = await adsFetch("/campaignBudgets:mutate", "POST", {
    operations: [
      {
        create: {
          name: `${input.campaignName} — budget`,
          amountMicros: String(budgetMicros),
          deliveryMethod: "STANDARD",
        },
      },
    ],
  });
  if (!budgetRes.ok) return { success: false, error: `Budget : ${budgetRes.error}` };
  const budgetResource = extractResource(budgetRes.data);

  // 2. Campaign (Search, PAUSED for safety)
  const campRes = await adsFetch("/campaigns:mutate", "POST", {
    operations: [
      {
        create: {
          name: input.campaignName,
          status: "PAUSED",
          advertisingChannelType: "SEARCH",
          manualCpc: { enhancedCpcEnabled: false },
          campaignBudget: budgetResource,
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
        },
      },
    ],
  });
  if (!campRes.ok) return { success: false, error: `Campagne : ${campRes.error}` };
  const campaignResource = extractResource(campRes.data);

  // 3. Ad group
  const groupRes = await adsFetch("/adGroups:mutate", "POST", {
    operations: [
      {
        create: {
          name: `${input.campaignName} — group`,
          status: "ENABLED",
          campaign: campaignResource,
          type: "SEARCH_STANDARD",
          cpcBidMicros: String(Math.floor(budgetMicros / 10)),
        },
      },
    ],
  });
  if (!groupRes.ok) return { success: false, error: `Ad group : ${groupRes.error}` };
  const adGroupResource = extractResource(groupRes.data);

  // 4. Responsive Search Ad + keywords (parallel, both depend on adGroup)
  const headlines = input.headlines.slice(0, 15).map((t) => ({ text: t.slice(0, 30) }));
  const descriptions = input.descriptions.slice(0, 4).map((t) => ({ text: t.slice(0, 90) }));

  const [adRes, kwRes] = await Promise.all([
    adsFetch("/adGroupAds:mutate", "POST", {
      operations: [
        {
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            ad: {
              finalUrls: [input.finalUrl],
              responsiveSearchAd: { headlines, descriptions },
            },
          },
        },
      ],
    }),
    adsFetch("/adGroupCriteria:mutate", "POST", {
      operations: input.keywords.slice(0, 20).map((kw) => ({
        create: {
          adGroup: adGroupResource,
          status: "ENABLED",
          keyword: { text: kw, matchType: "BROAD" },
        },
      })),
    }),
  ]);

  if (!adRes.ok) return { success: false, error: `Annonce : ${adRes.error}` };
  if (!kwRes.ok) return { success: false, error: `Mots-clés : ${kwRes.error}` };

  return { success: true, campaignResource, adGroupResource, budgetResource };
}

/** Toggle a Google Ads campaign ENABLED / PAUSED / REMOVED. */
export async function setGoogleCampaignStatus(
  campaignResource: string,
  status: "ENABLED" | "PAUSED" | "REMOVED",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await adsFetch("/campaigns:mutate", "POST", {
    operations: [
      {
        update: { resourceName: campaignResource, status },
        updateMask: "status",
      },
    ],
  });
  if (!r.ok) {
    logger.warn({ err: r.error, campaignResource, status }, "Google campaign status change failed");
    return { ok: false, error: r.error };
  }
  return { ok: true };
}

/** Fetch impressions / clicks / spend for a Google Ads campaign via GAQL. */
export async function getGoogleCampaignMetrics(
  campaignResource: string,
): Promise<
  | { ok: true; impressions: number; clicks: number; spendCents: number }
  | { ok: false; error: string }
> {
  // resourceName format: customers/{cid}/campaigns/{campId}
  const campaignId = campaignResource.split("/").pop() ?? "";
  if (!campaignId) return { ok: false, error: "resourceName invalide" };
  const r = await adsFetch("/googleAds:searchStream", "POST", {
    query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE campaign.id = ${campaignId}`,
  });
  if (!r.ok) return { ok: false, error: r.error };
  const stream = (r.data["results"] as Array<Record<string, unknown>>) ?? [];
  let impressions = 0;
  let clicks = 0;
  let costMicros = 0;
  for (const row of stream) {
    const m = row["metrics"] as { impressions?: string; clicks?: string; costMicros?: string };
    impressions += Number(m?.impressions ?? 0);
    clicks += Number(m?.clicks ?? 0);
    costMicros += Number(m?.costMicros ?? 0);
  }
  return { ok: true, impressions, clicks, spendCents: Math.round(costMicros / 10_000) };
}

function extractResource(data: Record<string, unknown>): string {
  const results = (data["results"] as Array<{ resourceName?: string }>) ?? [];
  return results[0]?.resourceName ?? "";
}
