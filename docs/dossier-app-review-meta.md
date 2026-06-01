# Dossier App Review Meta — GrowIQ

Application : **Growiq.ai** — ID `3484923875007702`
Objectif : faire passer l'app de « En développement » à « Live » pour que n'importe quel client puisse connecter son Facebook / Instagram et publier via GrowIQ, sans être invité comme testeur.

Ce dossier contient tout ce qu'il faut pour réussir l'App Review du **premier coup** :
1. La checklist des prérequis (à faire AVANT de soumettre)
2. La vérification de l'entreprise (Business Verification)
3. La justification de chaque permission (textes à copier-coller dans le formulaire Meta)
4. Le script précis de la vidéo de démo (ce que Meta exige de voir)
5. Les erreurs fréquentes qui font refuser un dossier

---

## 1. Prérequis à régler AVANT de soumettre

Meta refuse automatiquement si l'un de ces éléments manque. À vérifier dans **developers.facebook.com → Growiq.ai → Paramètres → Général** :

- [ ] **Icône de l'app** (1024×1024) renseignée
- [ ] **Catégorie** de l'app choisie (ex. « Entreprise et pages »)
- [ ] **URL de la politique de confidentialité** : doit être une page publique accessible (ex. `https://growiq.tech/confidentialite`)
- [ ] **URL des conditions d'utilisation** (recommandé) : ex. `https://growiq.tech/cgu`
- [ ] **URL de suppression des données utilisateur** (Data Deletion) : page ou instructions expliquant comment un utilisateur supprime ses données
- [ ] **Email de contact** valide
- [ ] **Domaine de l'app** renseigné : `growiq.tech`
- [ ] Dans **Facebook Login → Paramètres** : l'URI de redirection OAuth de GrowIQ est bien dans la liste des « Valid OAuth Redirect URIs »

> Important : si la page Politique de confidentialité n'existe pas encore, c'est le blocage n°1. Il faut une vraie page en ligne, pas un brouillon.

---

## 2. Vérification de l'entreprise (Business Verification)

Obligatoire pour les permissions avancées de publication. Dans **business.facebook.com → Paramètres de l'entreprise → Centre de sécurité** :

- [ ] Nom légal de l'entreprise
- [ ] Adresse, numéro de téléphone professionnel
- [ ] Un **justificatif** parmi : extrait Kbis / SIRENE, facture d'un service public au nom de l'entreprise, relevé bancaire pro
- [ ] Vérification du numéro de téléphone ou de l'email au nom du domaine

Délai : de quelques heures à quelques jours. À lancer **en parallèle** de l'App Review, pas après.

---

## 3. Permissions à demander + justifications (copier-coller)

GrowIQ demande 6 permissions soumises à review. Pour chacune, colle le texte ci-dessous dans le champ « Tell us how you'll use this permission » du formulaire Meta. (Meta accepte l'anglais ; si le champ l'autorise, tu peux laisser en français, mais l'anglais passe plus vite.)

### 3.1 — `pages_show_list`
**FR :** GrowIQ affiche à l'utilisateur la liste de ses propres pages Facebook après connexion, pour qu'il choisisse celle sur laquelle publier. Sans cette permission, impossible d'identifier la page à gérer.

**EN :** After the user logs in with Facebook, GrowIQ retrieves the list of Facebook Pages they manage so they can select which Page to connect. This is required to identify the target Page before any publishing action.

### 3.2 — `pages_manage_posts`
**FR :** GrowIQ publie, au nom de l'utilisateur et avec son accord, les posts marketing qu'il a créés et programmés dans l'application, sur SA propre page Facebook. La publication est déclenchée par l'utilisateur (programmation ou bouton « Publier »).

**EN :** GrowIQ publishes marketing posts to the user's own Facebook Page, on their behalf and with their explicit consent. Posts are created and scheduled by the user inside GrowIQ; publishing is triggered by the user (schedule or "Publish" button). No content is posted without the user's action.

### 3.3 — `pages_read_engagement`
**FR :** GrowIQ affiche à l'utilisateur les statistiques de ses propres publications (vues, mentions J'aime, partages) pour mesurer la performance de ses campagnes. Lecture seule, uniquement sur les pages de l'utilisateur.

**EN :** GrowIQ reads engagement metrics (views, likes, shares) of the user's own Page posts to display campaign performance back to the user. Read-only, limited to the user's own Pages.

### 3.4 — `instagram_basic`
**FR :** GrowIQ identifie le compte Instagram Business lié à la page Facebook de l'utilisateur (nom d'utilisateur, identifiant) afin de pouvoir y publier. Aucune donnée tierce n'est lue.

**EN :** GrowIQ identifies the Instagram Business account linked to the user's Facebook Page (username, ID) to enable publishing to it. Only the user's own connected account is accessed.

### 3.5 — `instagram_content_publish`
**FR :** GrowIQ publie, avec l'accord de l'utilisateur, les visuels et légendes qu'il a créés dans l'application, sur SON propre compte Instagram Business lié à sa page Facebook. Déclenché par l'utilisateur.

**EN :** GrowIQ publishes images and captions, created by the user inside the app, to the user's own Instagram Business account linked to their Facebook Page, with the user's consent and triggered by the user.

### 3.6 — `business_management`
**FR :** Certaines pages Facebook des utilisateurs sont rattachées à un Business Manager. Cette permission permet à GrowIQ de retrouver et gérer ces pages au nom de l'utilisateur, uniquement pour les actions de publication décrites ci-dessus.

**EN :** Some users' Facebook Pages are owned by a Business Manager. This permission allows GrowIQ to access and manage those Pages on the user's behalf, solely for the publishing actions described above.

> Astuce : si tu veux simplifier le dossier, tu peux retirer `business_management` de la première soumission et ne demander que les 5 autres (la plupart des pages personnelles fonctionnent sans). Tu l'ajouteras plus tard si des clients ont des pages en Business Manager. Moins de permissions = review plus rapide.

---

## 4. Script de la vidéo de démo (ce que Meta exige)

Meta demande une vidéo (écran enregistré) montrant **un vrai parcours utilisateur**, du login jusqu'à l'usage de chaque permission. Enregistre ton écran (ex. avec l'outil d'enregistrement de Windows, ou Loom) en te connectant avec un compte **testeur** (puisque l'app est encore en dev). Durée idéale : 2 à 4 minutes.

**Déroulé à filmer, étape par étape :**

1. **Montre la page de connexion GrowIQ** (growiq.tech). Connecte-toi à ton compte.
2. **Va dans « Mes outils → Intégrations ».** Montre la carte « Connecter Facebook ».
3. **Clique sur « Connecter Facebook ».** Filme la fenêtre Facebook qui s'ouvre.
4. **Montre l'écran d'autorisation Facebook** où l'utilisateur voit la liste des permissions demandées, et clique « Autoriser ». → couvre `pages_show_list`, `instagram_basic`.
5. **Reviens sur GrowIQ** : montre que la page Facebook et le compte Instagram sont maintenant connectés (badge « Connecté »).
6. **Crée un post marketing** dans GrowIQ (texte + visuel). Montre l'éditeur.
7. **Publie / programme le post sur Facebook.** → couvre `pages_manage_posts`.
8. **Va sur la vraie page Facebook** dans un autre onglet et montre que le post est bien apparu. (Preuve concrète, Meta adore ça.)
9. **Refais la même chose pour Instagram** : publie un visuel, puis montre le post sur le compte Instagram. → couvre `instagram_content_publish`.
10. **Montre l'écran de statistiques** dans GrowIQ (vues / likes / partages d'un post). → couvre `pages_read_engagement`.
11. Si tu demandes `business_management` : montre une page rattachée à un Business Manager qui apparaît bien dans la liste à l'étape 4-5.

**Règles d'or pour la vidéo :**
- Filme dans l'ordre, sans coupure brutale ; on doit comprendre le parcours.
- Chaque permission demandée DOIT être visible en action dans la vidéo, sinon refus.
- Pas de données floutées sur les boutons d'autorisation : Meta doit voir le dialogue de permission.
- Voix off ou sous-titres (même courts) aident l'examinateur.

---

## 5. Erreurs fréquentes qui font refuser (à éviter)

- **Page Politique de confidentialité absente ou inaccessible** → cause de refus n°1.
- **Une permission demandée mais jamais montrée dans la vidéo** → refus de cette permission.
- **Vidéo qui montre l'écran admin** au lieu d'un vrai parcours utilisateur.
- **Business Verification non faite** → les permissions de publication restent bloquées même si la review passe.
- **Décrire un usage différent du réel** (ex. dire qu'on lit des données qu'on ne lit pas) → refus pour incohérence.
- **Oublier de basculer l'interrupteur sur « Live »** une fois tout approuvé → l'app reste privée. C'est la toute dernière étape, à ne pas oublier.

---

## 6. Où soumettre

developers.facebook.com → app **Growiq.ai** → menu de gauche **Vérification de l'app (App Review)** → **Autorisations et fonctionnalités**. Pour chaque permission de la liste ci-dessus : clique **« Demander l'accès avancé »**, remplis la justification (section 3) et joins la vidéo (section 4).

Une fois TOUT approuvé + Business Verification validée → reviens sur le tableau de bord et bascule l'interrupteur du haut sur **« Live »**.

---

## Récap de l'ordre des opérations

1. Régler les prérequis (section 1) — surtout la page Politique de confidentialité.
2. Lancer la Business Verification (section 2) — en parallèle.
3. Enregistrer la vidéo de démo avec un compte testeur (section 4).
4. Soumettre les permissions avec les justifications (section 3 + 6).
5. Attendre l'approbation (1 à 3 semaines).
6. Basculer l'app sur « Live ».
7. Tes clients peuvent maintenant se connecter sans invitation.
