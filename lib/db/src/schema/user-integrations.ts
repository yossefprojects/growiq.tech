import {
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Plateformes supportées dans user_integrations.
// LinkedIn a sa propre table héritée (linkedin_connections) ; on peut migrer
// plus tard. Pour l'instant, FB et IG partagent une connexion Meta (même OAuth),
// Resend est une clé API simple, Google Ads sera un OAuth séparé.
export type UserIntegrationPlatform = "meta" | "resend" | "google_ads";

// Statut human-readable. `expired` = il faut reconnecter, `revoked` = l'utilisateur
// a explicitement déconnecté côté provider (ex: webhook Meta deauthorize).
export type UserIntegrationStatus =
  | "active"
  | "expired"
  | "revoked"
  | "error";

// Métadonnées spécifiques à chaque provider. On reste large pour ne pas
// re-migrer à chaque ajout de champ.
export type UserIntegrationMetadata = {
  // Meta : pages FB de l'user (utile si plusieurs pages liées au token)
  facebookPages?: Array<{ id: string; name: string; accessToken: string; category?: string }>;
  // Meta : compte Instagram Business lié à la page FB choisie
  instagramAccount?: { id: string; username?: string };
  // Meta : id de la page FB actuellement sélectionnée pour publier
  selectedFacebookPageId?: string;
  // Resend : domaine d'envoi (ex: contact@monentreprise.com)
  fromEmail?: string;
  // Resend : nom d'affichage (ex: "GrowIQ — Marie")
  fromName?: string;
  // Resend : true si on a réussi à envoyer un email de test depuis cette config
  verifiedAt?: string;
  // Provider profile display (avatar, name) pour l'UI
  displayName?: string;
  displayAvatarUrl?: string;
  // Last error human-readable (pour afficher dans l'UI à côté de "Reconnecter")
  lastErrorMessage?: string;
};

// Un user peut avoir UNE connexion active par plateforme (on déduplique avec
// l'unique index sur user_id + platform).
export const userIntegrations = pgTable(
  "user_integrations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    platform: text("platform").$type<UserIntegrationPlatform>().notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    // Identifiant principal côté provider (ex: FB page id, Meta user id,
    // domaine Resend). Sert à l'affichage et au routing.
    accountId: text("account_id"),
    // Label human-readable (ex: "Boulangerie Dupont", "contact@dupont.fr")
    accountLabel: text("account_label"),
    metadata: jsonb("metadata").$type<UserIntegrationMetadata>().notNull().default({}),
    status: text("status").$type<UserIntegrationStatus>().notNull().default("active"),
    // Dernier check de validité (ex: dernier appel Meta /debug_token réussi).
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Une seule connexion active par (user, platform). L'OAuth callback fait
    // un upsert sur cet index.
    uniqueIndex("user_integrations_user_platform_unique").on(t.userId, t.platform),
    index("user_integrations_user_id_idx").on(t.userId),
    index("user_integrations_platform_idx").on(t.platform),
  ],
);

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type InsertUserIntegration = typeof userIntegrations.$inferInsert;
