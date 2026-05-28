/**
 * Compteur freemium : 100 emails/mois par utilisateur quand il utilise la clé
 * admin partagée. Reset implicite chaque 1er du mois (nouvelle ligne créée
 * automatiquement à la 1ère send).
 *
 * Quand l'user a sa propre clé Resend dans `user_integrations`, on n'utilise
 * pas ce compteur (illimité côté GrowIQ — c'est l'user qui paie son Resend).
 */
import { and, eq, sql } from "drizzle-orm";
import { db, emailUsage, FREEMIUM_EMAIL_MONTHLY_QUOTA } from "@workspace/db";

function currentYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export async function getMonthlyEmailUsage(userId: string): Promise<{
  used: number;
  quota: number;
  remaining: number;
  year: number;
  month: number;
}> {
  const { year, month } = currentYearMonth();
  const [row] = await db
    .select()
    .from(emailUsage)
    .where(
      and(
        eq(emailUsage.userId, userId),
        eq(emailUsage.year, year),
        eq(emailUsage.month, month),
      ),
    )
    .limit(1);
  const used = row?.count ?? 0;
  return {
    used,
    quota: FREEMIUM_EMAIL_MONTHLY_QUOTA,
    remaining: Math.max(0, FREEMIUM_EMAIL_MONTHLY_QUOTA - used),
    year,
    month,
  };
}

/**
 * Tente de réserver `count` emails sur le quota mensuel.
 * Atomique : upsert + UPDATE conditionnel. Retourne `{allowed:true}` si tout
 * passe, ou `{allowed:false}` si on dépasse le quota (l'envoi doit être bloqué).
 *
 * Pattern :
 *   1. INSERT … ON CONFLICT DO NOTHING (assure que la row existe)
 *   2. UPDATE … SET count = count + n WHERE count + n <= quota
 *      RETURNING count
 *
 * Si l'UPDATE ne renvoie rien → quota dépassé.
 */
export async function reserveEmailsFromQuota(
  userId: string,
  count: number,
): Promise<{ allowed: true; newCount: number } | { allowed: false; used: number; quota: number }> {
  if (count <= 0) return { allowed: true, newCount: 0 };
  const { year, month } = currentYearMonth();

  // 1) Garantir l'existence de la row (no-op si elle existe déjà)
  await db
    .insert(emailUsage)
    .values({ userId, year, month, count: 0 })
    .onConflictDoNothing({
      target: [emailUsage.userId, emailUsage.year, emailUsage.month],
    });

  // 2) Tenter d'incrémenter atomiquement sous la limite
  const rows = await db
    .update(emailUsage)
    .set({
      count: sql`${emailUsage.count} + ${count}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(emailUsage.userId, userId),
        eq(emailUsage.year, year),
        eq(emailUsage.month, month),
        sql`${emailUsage.count} + ${count} <= ${FREEMIUM_EMAIL_MONTHLY_QUOTA}`,
      ),
    )
    .returning({ count: emailUsage.count });

  if (rows.length === 0) {
    const current = await getMonthlyEmailUsage(userId);
    return { allowed: false, used: current.used, quota: current.quota };
  }
  return { allowed: true, newCount: rows[0]?.count ?? count };
}

/**
 * Décrémente le compteur (utilisé si l'envoi échoue après réservation).
 * Best-effort, on ne crash pas si la row n'existe pas.
 */
export async function refundEmailsToQuota(userId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const { year, month } = currentYearMonth();
  await db
    .update(emailUsage)
    .set({
      count: sql`GREATEST(0, ${emailUsage.count} - ${count})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(emailUsage.userId, userId),
        eq(emailUsage.year, year),
        eq(emailUsage.month, month),
      ),
    );
}
