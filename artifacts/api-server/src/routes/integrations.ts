/**
 * Routes /api/integrations/* — vue unifiée multi-platform pour l'utilisateur.
 *
 * GET /api/integrations               → statut FB/IG/LinkedIn/Resend/Google Ads
 * GET /api/integrations/email-usage   → quota mensuel freemium
 * POST /api/integrations/resend       → enregistrer clé + domaine d'envoi
 * POST /api/integrations/resend/test  → envoyer un email de test
 * DELETE /api/integrations/:platform  → déconnecter
 *
 * LinkedIn reste sur sa propre table (linkedin_connections) — on lit juste son
 * statut ici pour l'agrégation UI.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, linkedinConnections } from "@workspace/db";
import type { AuthedRequest } from "../middlewares/auth";
import {
  deleteUserIntegration,
  getUserIntegration,
  upsertUserIntegration,
} from "../lib/user-integrations";
import {
  isFacebookOAuthConfigured,
} from "../lib/facebook-oauth";
import { isLinkedinConfigured } from "../lib/linkedin";
import { isGoogleOAuthConfigured } from "../lib/google-oauth";
import { sendEmail } from "../lib/email";
import { getMonthlyEmailUsage } from "../lib/email-usage";
import { logger } from "../lib/logger";

function uid(req: unknown): string {
  return (req as AuthedRequest).userId;
}
function email(req: unknown): string | null {
  return (req as AuthedRequest).userEmail;
}

const router: IRouter = Router();
export default router;

router.get("/integrations", async (req, res) => {
  const userId = uid(req);

  // Évite les 304 cache côté client : on veut que toute mise à jour de
  // secrets côté serveur se reflète immédiatement.
  res.setHeader("Cache-Control", "no-store");

  const [meta, resend, googleAds, linkedin] = await Promise.all([
    getUserIntegration(userId, "meta"),
    getUserIntegration(userId, "resend"),
    getUserIntegration(userId, "google_ads"),
    db
      .select()
      .from(linkedinConnections)
      .where(eq(linkedinConnections.userId, userId))
      .limit(1)
      .then((rs) => rs[0] ?? null),
  ]);

  const now = Date.now();
  const metaExpired = !!(meta?.expiresAt && meta.expiresAt.getTime() < now);
  const linkedinExpired = !!(linkedin?.expiresAt && linkedin.expiresAt.getTime() < now);
  // Pour Google Ads on a un refresh_token long-lived : tant qu'il est présent,
  // on peut renouveler l'access_token. Donc "expired" UNIQUEMENT si pas de
  // refresh_token (cas anormal où Google n'aurait rien renvoyé).
  const googleAdsExpired = !!googleAds && !googleAds.refreshToken;
  const selectedAdId = meta?.metadata?.selectedMetaAdAccountId ?? null;
  const selectedAdAccount = selectedAdId
    ? meta?.metadata?.metaAdAccounts?.find((a) => a.id === selectedAdId) ?? null
    : null;

  res.json({
    facebook: {
      platform: "facebook",
      configured: isFacebookOAuthConfigured(),
      connected: !!meta && meta.status === "active" && !metaExpired,
      expired: metaExpired,
      label: meta?.accountLabel ?? null,
      displayName: meta?.metadata?.displayName ?? null,
      expiresAt: meta?.expiresAt ?? null,
      lastErrorMessage: meta?.metadata?.lastErrorMessage ?? null,
    },
    instagram: {
      platform: "instagram",
      configured: isFacebookOAuthConfigured(),
      connected:
        !!meta &&
        meta.status === "active" &&
        !metaExpired &&
        !!meta.metadata?.instagramAccount?.id,
      expired: metaExpired,
      username: meta?.metadata?.instagramAccount?.username ?? null,
      expiresAt: meta?.expiresAt ?? null,
    },
    linkedin: {
      platform: "linkedin",
      configured: isLinkedinConfigured(),
      connected: !!linkedin && !linkedinExpired,
      expired: linkedinExpired,
      label: linkedin?.name ?? null,
      email: linkedin?.email ?? null,
      pictureUrl: linkedin?.pictureUrl ?? null,
      expiresAt: linkedin?.expiresAt ?? null,
    },
    resend: {
      platform: "resend",
      configured: true, // mode freemium toujours possible
      connected: !!resend && resend.status === "active",
      fromEmail: resend?.metadata?.fromEmail ?? null,
      fromName: resend?.metadata?.fromName ?? null,
      verifiedAt: resend?.metadata?.verifiedAt ?? null,
      lastErrorMessage: resend?.metadata?.lastErrorMessage ?? null,
    },
    metaAds: {
      platform: "meta_ads",
      // Configuré = OAuth Meta dispo. La VRAIE possibilité de booster nécessite
      // que l'user ait au moins un compte pub (firstActiveAd) et que Meta ait
      // validé le scope ads_management pour notre App.
      configured: isFacebookOAuthConfigured(),
      // "Connected" = compte FB connecté + au moins un compte pub Meta visible
      connected:
        !!meta &&
        meta.status === "active" &&
        !metaExpired &&
        !!selectedAdAccount,
      expired: metaExpired,
      adAccountId: selectedAdAccount?.id ?? null,
      adAccountName: selectedAdAccount?.name ?? null,
      currency: selectedAdAccount?.currency ?? null,
      adAccountsCount: meta?.metadata?.metaAdAccounts?.length ?? 0,
    },
    googleAds: {
      platform: "google_ads",
      configured: isGoogleOAuthConfigured(),
      connected: !!googleAds && googleAds.status === "active" && !googleAdsExpired,
      expired: googleAdsExpired,
      email: googleAds?.metadata?.googleAdsEmail ?? null,
      customerId: googleAds?.metadata?.googleAdsCustomerId ?? null,
      // Tradeoff signalé : tant que le Developer Token Basic Access Google n'est
      // pas validé, on peut connecter l'OAuth mais pas créer de vraies campagnes.
      apiReady: !!process.env["GOOGLE_ADS_DEVELOPER_TOKEN"],
    },
  });
});

router.get("/integrations/email-usage", async (req, res) => {
  const userId = uid(req);
  // Si l'user a sa propre clé Resend → pas de quota GrowIQ
  const own = await getUserIntegration(userId, "resend");
  if (own && own.status === "active") {
    res.json({ usingOwnKey: true, quota: null, used: null, remaining: null });
    return;
  }
  const usage = await getMonthlyEmailUsage(userId);
  res.json({ usingOwnKey: false, ...usage });
});

// ── Resend per-user ───────────────────────────────────────────────────────

const resendBodySchema = z.object({
  apiKey: z
    .string()
    .min(10, "Clé API trop courte")
    .max(200, "Clé API trop longue")
    .regex(/^re_/, "Une clé Resend commence par 're_'"),
  fromEmail: z.string().email("Adresse email invalide"),
  fromName: z.string().max(80).optional().nullable(),
});

router.post("/integrations/resend", async (req, res) => {
  const parsed = resendBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
    return;
  }
  const { apiKey, fromEmail, fromName } = parsed.data;
  await upsertUserIntegration({
    userId: uid(req),
    platform: "resend",
    accessToken: apiKey,
    accountId: fromEmail,
    accountLabel: fromEmail,
    metadata: {
      fromEmail,
      fromName: fromName ?? undefined,
    },
    status: "active",
    lastVerifiedAt: null, // pas encore testée
  });
  res.json({ ok: true });
});

router.post("/integrations/resend/test", async (req, res) => {
  const userId = uid(req);
  const userEmail = email(req);
  const target =
    typeof req.body?.to === "string" && req.body.to.length > 0 ? req.body.to : userEmail;
  if (!target) {
    res.status(400).json({
      error: "Aucune adresse de test. Renseigne l'email de réception sur ton compte Clerk.",
    });
    return;
  }
  const conn = await getUserIntegration(userId, "resend");
  if (!conn || conn.status !== "active") {
    res
      .status(412)
      .json({ error: "Configure d'abord ta clé Resend pour tester la connexion." });
    return;
  }
  try {
    const result = await sendEmail({
      to: [target],
      subject: "GrowIQ — Test de connexion Resend",
      body: "Bonne nouvelle : ta clé Resend fonctionne et GrowIQ peut envoyer des emails depuis ton domaine.\n\nÀ très vite,\nL'équipe GrowIQ",
      html: '<div style="font-family:sans-serif;line-height:1.5;color:#111"><h2 style="color:#16a34a">Connexion OK</h2><p>Ta clé Resend fonctionne et GrowIQ peut envoyer des emails depuis <strong>' +
        conn.metadata?.fromEmail +
        '</strong>.</p><p style="color:#666;font-size:13px">— Email automatique de test, ne pas répondre.</p></div>',
      userId, // utilisera la clé perso (priorité 1)
      tags: [{ name: "type", value: "test" }],
    });
    if (!result.success) {
      // Marquer l'integration en erreur pour rendre visible dans l'UI
      await upsertUserIntegration({
        userId,
        platform: "resend",
        accessToken: conn.accessToken,
        accountId: conn.accountId,
        accountLabel: conn.accountLabel,
        metadata: {
          ...conn.metadata,
          lastErrorMessage: result.error ?? "Échec du test",
        },
        status: "error",
        lastVerifiedAt: null,
      });
      res.status(502).json({ ok: false, error: result.error });
      return;
    }
    // Succès → on marque verifiedAt
    await upsertUserIntegration({
      userId,
      platform: "resend",
      accessToken: conn.accessToken,
      accountId: conn.accountId,
      accountLabel: conn.accountLabel,
      metadata: {
        ...conn.metadata,
        verifiedAt: new Date().toISOString(),
        lastErrorMessage: undefined,
      },
      status: "active",
      lastVerifiedAt: new Date(),
    });
    res.json({ ok: true, sentTo: target, messageId: result.messageId ?? null });
  } catch (err) {
    logger.error({ err }, "resend test send failed");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" });
  }
});

router.delete("/integrations/:platform", async (req, res) => {
  const platform = req.params.platform;
  if (platform === "linkedin") {
    await db.delete(linkedinConnections).where(eq(linkedinConnections.userId, uid(req)));
    res.json({ ok: true });
    return;
  }
  if (platform !== "meta" && platform !== "resend" && platform !== "google_ads") {
    res.status(400).json({ error: "platform inconnue" });
    return;
  }
  await deleteUserIntegration(uid(req), platform);
  res.json({ ok: true });
});
