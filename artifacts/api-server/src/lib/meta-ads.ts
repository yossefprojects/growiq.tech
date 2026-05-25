/**
 * Meta Marketing API wrapper — Facebook & Instagram paid ads.
 *
 * Requires:
 *   - META_ACCESS_TOKEN  (with `ads_management` permission — granted by App Review)
 *   - META_AD_ACCOUNT_ID (format: `act_1234567890` — found in Business Manager → Ad Accounts)
 *   - META_FB_PAGE_ID    (already used for organic publishing)
 *
 * Most-common flow: "boost an existing post" = create a campaign + ad set + ad
 * that promotes an organic post we already published. This requires the post
 * to exist on the FB Page (we have its id in scheduledPosts.meta.metaPostId).
 */
import { logger } from "./logger";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function getConfig(): { token?: string; adAccountId?: string; fbPageId?: string } {
  return {
    token: process.env["META_ACCESS_TOKEN"],
    adAccountId: process.env["META_AD_ACCOUNT_ID"],
    fbPageId: process.env["META_FB_PAGE_ID"],
  };
}

export function isMetaAdsConfigured(): { configured: boolean; missing: string[] } {
  const { token, adAccountId } = getConfig();
  const missing: string[] = [];
  if (!token) missing.push("META_ACCESS_TOKEN");
  if (!adAccountId) missing.push("META_AD_ACCOUNT_ID");
  return { configured: missing.length === 0, missing };
}

async function graphFetch(
  path: string,
  method: "GET" | "POST" | "DELETE",
  token: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const init: RequestInit = { method, headers };
    if (body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${GRAPH_BASE}${path}`, init);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data["error"] as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      return { ok: false, error: err };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export type MetaBoostResult =
  | { success: true; campaignId: string; adSetId: string; adId: string }
  | { success: false; error: string; configMissing?: boolean };

export type MetaBoostInput = {
  /** The organic FB post id we want to boost (from scheduledPosts.meta.metaPostId). */
  fbPostId: string;
  /** Daily budget in cents (e.g. 500 = 5.00 EUR per day). */
  dailyBudgetCents: number;
  /** How many days the boost should run. */
  durationDays: number;
  /** Human-readable name shown in Ads Manager. */
  campaignName: string;
  /**
   * Targeting — minimal sensible default if omitted.
   * Meta accepts a rich targeting spec; we expose the common knobs only.
   */
  targeting?: {
    countries?: string[]; // ISO codes, e.g. ["FR", "BE"]
    ageMin?: number;
    ageMax?: number;
    interests?: { id: string; name: string }[];
  };
};

/**
 * Boost an existing organic Facebook post via a paid campaign.
 *
 * Creates the standard 3-level Meta Ads object graph:
 *   Campaign (objective POST_ENGAGEMENT)
 *     └─ Ad Set (budget + targeting + schedule)
 *         └─ Ad (creative = the existing post)
 *
 * Campaign starts PAUSED — caller activates it with `activateCampaign()` once
 * everything is verified. This is the safest pattern (no accidental spend).
 */
export async function boostFacebookPost(input: MetaBoostInput): Promise<MetaBoostResult> {
  const { token, adAccountId, fbPageId } = getConfig();
  if (!token || !adAccountId || !fbPageId) {
    return {
      success: false,
      error: "Meta Ads pas encore configuré (token, ad account ou page id manquant)",
      configMissing: true,
    };
  }

  const startTime = new Date();
  const endTime = new Date(Date.now() + input.durationDays * 24 * 60 * 60_000);

  // 1. Campaign
  const camp = await graphFetch(`/${adAccountId}/campaigns`, "POST", token, {
    name: input.campaignName,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
  });
  if (!camp.ok) return { success: false, error: `Création campagne : ${camp.error}` };
  const campaignId = String(camp.data["id"] ?? "");
  if (!campaignId) return { success: false, error: "Campagne créée sans id" };

  // 2. Ad Set — targeting defaults to broad in user's country if not specified
  const targeting = {
    geo_locations: { countries: input.targeting?.countries ?? ["FR"] },
    age_min: input.targeting?.ageMin ?? 18,
    age_max: input.targeting?.ageMax ?? 65,
    ...(input.targeting?.interests?.length
      ? { interests: input.targeting.interests }
      : {}),
  };
  const adSet = await graphFetch(`/${adAccountId}/adsets`, "POST", token, {
    name: `${input.campaignName} — set`,
    campaign_id: campaignId,
    daily_budget: input.dailyBudgetCents,
    billing_event: "IMPRESSIONS",
    optimization_goal: "POST_ENGAGEMENT",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: "PAUSED",
  });
  if (!adSet.ok) {
    await deleteObject(campaignId, token).catch(() => undefined);
    return { success: false, error: `Création ad set : ${adSet.error}` };
  }
  const adSetId = String(adSet.data["id"] ?? "");

  // 3. Creative — reference the existing organic post (object_story_id format: pageId_postId)
  const storyId = input.fbPostId.includes("_") ? input.fbPostId : `${fbPageId}_${input.fbPostId}`;
  const creative = await graphFetch(`/${adAccountId}/adcreatives`, "POST", token, {
    name: `${input.campaignName} — creative`,
    object_story_id: storyId,
  });
  if (!creative.ok) {
    await deleteObject(campaignId, token).catch(() => undefined);
    return { success: false, error: `Création créative : ${creative.error}` };
  }
  const creativeId = String(creative.data["id"] ?? "");

  // 4. Ad
  const ad = await graphFetch(`/${adAccountId}/ads`, "POST", token, {
    name: `${input.campaignName} — ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });
  if (!ad.ok) {
    await deleteObject(campaignId, token).catch(() => undefined);
    return { success: false, error: `Création annonce : ${ad.error}` };
  }
  const adId = String(ad.data["id"] ?? "");

  return { success: true, campaignId, adSetId, adId };
}

/** Toggle a Meta campaign ACTIVE (after sanity checks) or PAUSED. */
export async function setMetaCampaignStatus(
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { token } = getConfig();
  if (!token) return { ok: false, error: "META_ACCESS_TOKEN manquant" };
  const r = await graphFetch(`/${campaignId}`, "POST", token, { status });
  if (!r.ok) {
    logger.warn({ err: r.error, campaignId, status }, "Meta campaign status change failed");
    return { ok: false, error: r.error };
  }
  return { ok: true };
}

/** Fetch lifetime insights (impressions, clicks, spend) for a Meta campaign. */
export async function getMetaCampaignInsights(
  campaignId: string,
): Promise<
  | { ok: true; impressions: number; clicks: number; spendCents: number }
  | { ok: false; error: string }
> {
  const { token } = getConfig();
  if (!token) return { ok: false, error: "META_ACCESS_TOKEN manquant" };
  const r = await graphFetch(
    `/${campaignId}/insights?fields=impressions,clicks,spend`,
    "GET",
    token,
  );
  if (!r.ok) return { ok: false, error: r.error };
  const rows = (r.data["data"] as Array<Record<string, string>>) ?? [];
  const row = rows[0] ?? {};
  return {
    ok: true,
    impressions: Number(row["impressions"] ?? 0),
    clicks: Number(row["clicks"] ?? 0),
    // Meta returns spend as a decimal string in the account currency. Convert to cents.
    spendCents: Math.round(Number(row["spend"] ?? 0) * 100),
  };
}

async function deleteObject(id: string, token: string): Promise<void> {
  await graphFetch(`/${id}`, "DELETE", token);
}
