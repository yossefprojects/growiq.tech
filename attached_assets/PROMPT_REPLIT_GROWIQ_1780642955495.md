# 🚀 Prompt Replit Agent — Refonte complète growiq.tech

## CE QUE TU DOIS FAIRE

Refonte visuelle complète du site **growiq.tech** (landing page + pages statiques).  
**Les fonctionnalités de `/app` ne changent pas — tu ne touches pas au code de l'application.**  
Tu redesignes uniquement : la landing page (`/`), la navbar, le footer, et les pages statiques (mentions légales, CGU, tarifs si page séparée).

---

## RÈGLES ABSOLUES

1. **Ne modifie RIEN dans `/app`** — ni les composants, ni le routing, ni les styles internes de l'app.
2. Applique les changements uniquement sur les fichiers de la landing page et des pages publiques.
3. Garde tous les liens existants (`/app`, `/login`, etc.) fonctionnels.
4. Ne supprime aucune section existante — redesigne-les.
5. Importe la font **Plus Jakarta Sans** depuis Google Fonts dans `index.html`.

---

## NOUVELLE IDENTITÉ VISUELLE

### Palette CSS — ajoute ces variables dans ton fichier CSS global

```css
:root {
  --void:      #08080F;
  --deep:      #0F0F1A;
  --purple:    #5B54D6;
  --purple2:   #7B74E8;
  --magenta:   #C026D3;
  --cyan:      #06B6D4;
  --white:     #FFFFFF;
  --bg:        #FAFAFA;
  --text:      #0F0F1A;
  --muted:     #64748B;
  --border:    #E2E8F0;

  --grad-hero:   linear-gradient(135deg, #08080F 0%, #0F0F1A 100%);
  --grad-purple: linear-gradient(135deg, #5B54D6 0%, #7B74E8 100%);
  --grad-magic:  linear-gradient(135deg, #5B54D6 0%, #C026D3 100%);
  --grad-glow:   radial-gradient(ellipse at center, rgba(91,84,214,0.15) 0%, transparent 70%);

  --font-sans:  'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', monospace;

  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  20px;
  --radius-pill: 50px;
}
```

### Font dans `index.html`

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## ANIMATIONS GLOBALES — ajoute dans le CSS global

```css
@keyframes fadeInUp {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes fadeInDown {
  from { opacity:0; transform:translateY(-18px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes float {
  0%,100% { transform:translateY(0) rotate(0deg); }
  33%      { transform:translateY(-12px) rotate(3deg); }
  66%      { transform:translateY(-6px) rotate(-2deg); }
}
@keyframes pulse-purple {
  0%,100% { box-shadow:0 0 0 0 rgba(91,84,214,0.4); }
  50%      { box-shadow:0 0 0 10px rgba(91,84,214,0); }
}
@keyframes shimmer {
  0%   { background-position:-200% center; }
  100% { background-position:200% center; }
}
@keyframes blink {
  50% { opacity:0; }
}
@keyframes slide-up {
  from { opacity:0; transform:translateY(40px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes countUp {
  from { opacity:0; transform:scale(0.8); }
  to   { opacity:1; transform:scale(1); }
}

/* Scroll reveal */
.reveal {
  opacity:0;
  transform:translateY(28px);
  transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1);
}
.reveal.visible { opacity:1; transform:translateY(0); }

.reveal-left {
  opacity:0; transform:translateX(-28px);
  transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1);
}
.reveal-left.visible { opacity:1; transform:translateX(0); }

.reveal-right {
  opacity:0; transform:translateX(28px);
  transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1);
}
.reveal-right.visible { opacity:1; transform:translateX(0); }
```

### Hook scroll reveal — crée `src/hooks/useScrollReveal.js`

```js
import { useEffect } from 'react'
export function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal,.reveal-left,.reveal-right')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}
```

---

## SECTIONS À CRÉER / REMPLACER

### 1. NAVBAR

Remplace la navbar actuelle par :

- **Fond :** transparent au départ, `rgba(8,8,15,0.92)` + `backdrop-filter: blur(20px)` au scroll (> 40px)
- **Bordure basse :** `1px solid rgba(91,84,214,0.2)` au scroll uniquement
- **Logo :** carré 32×32 gradient `#5B54D6 → #C026D3` avec ⚡, texte "Grow" blanc + "IQ" en gradient `#7B74E8 → #C026D3`, font-weight 800
- **Liens :** Fonctionnalités · Comment ça marche · Tarifs · FAQ — couleur `rgba(255,255,255,0.65)`, hover blanc
- **CTA :** bouton pill gradient `#5B54D6 → #C026D3`, texte "Lancer gratuitement →", glow au hover
- **Height :** 60px, position fixed, z-index 1000

---

### 2. HERO SECTION

- **Fond :** `linear-gradient(160deg, #08080F 0%, #0F0F1A 60%, #08080F 100%)`
- **Grille de fond** : lignes très subtiles violet `rgba(91,84,214,0.04)`, taille 48×48px
- **Glows ambiants :** 2 radial-gradients positionnés (violet centre-haut, magenta droite-bas)
- **Particules flottantes :** 8 emojis (⚡🎯📱✉️📊🚀💡🎨) positionnés en absolute avec animation `float`
- **Badge :** "Agent marketing IA en français" avec dot animé pulse-purple
- **Titre H1 :** "Lance tes campagnes" + saut de ligne + "marketing avec l'IA" en gradient shimmer `#7B74E8 → #C026D3 → #06B6D4`, font-size clamp(36px, 6.5vw, 72px), weight 900
- **Sous-titre :** "GrowIQ crée, programme et publie tes posts, emails et pubs à ta place — en moins de 10 minutes. Sans agence. En français."
- **Typewriter :** boîte avec effet machine à écrire qui affiche en boucle 4 exemples de campagnes, curseur clignotant `|`
- **CTAs :** bouton principal gradient (⚡ Lancer ma première campagne) + bouton ghost "Comment ça marche →"
- **Proof :** ✓ Gratuit pour commencer · ✓ Sans carte bancaire · ✓ 100% en français
- **Scroll indicator :** ligne verticale dégradée + texte "scroll" en bas de section

Implémente le typewriter avec useState + useEffect :
```
exemples = ['une promo pour mon restaurant ce soir', 'le lancement de ma nouvelle collection', 'une campagne email pour mes clients', 'mon ouverture de boutique samedi']
```
Affichage lettre par lettre (40ms), pause 1800ms, effacement lettre par lettre (18ms), boucle infinie.

---

### 3. SECTION "POUR QUI ?"

- **Fond :** `#0F0F1A`
- **Titre :** "Pas besoin d'être expert en marketing" avec "en marketing" en `#7B74E8`
- **6 cartes** en grille `repeat(auto-fill, minmax(280px, 1fr))` :
  - 🍕 Restaurateurs · 🧑‍💼 Coachs & Consultants · 🛍️ Commerçants · 🔨 Artisans · 🎨 Créateurs · 🏢 Petites entreprises
- **Hover carte :** fond `rgba(91,84,214,0.12)`, bordure violette, `translateY(-4px)`, emoji scale(1.15), barre gradient en bas qui s'élargit de 0 à 100%
- Ajoute classe `.reveal` avec `transitionDelay` échelonné

---

### 4. SECTION "COMMENT ÇA MARCHE ?" (3 étapes)

- **Fond :** `linear-gradient(160deg, #08080F, #0F0F1A)`
- **Titre :** "Une campagne prête en moins de 10 minutes" avec gradient sur "moins de 10 minutes"
- **3 étapes en grille :**
  1. 💬 **Tu décris ton projet** — conversation simple, pas de formulaire
  2. 🤖 **L'IA crée tout** — canaux, textes, visuels, horaires
  3. 🚀 **Tu valides et tu publies** — un clic, tout est en ligne
- **Numéro watermark :** "01" "02" "03" en opacity 6%, position absolute, font-size 120px, pour effet décoratif
- Hover : bordure violette + `translateY(-4px)`
- Révélation `.reveal` avec délais échelonnés

---

### 5. SECTION FONCTIONNALITÉS (6 features)

- **Fond :** `#0F0F1A`
- **Badge "Fonctionnalités" + titre :** "Tout ce dont tu as besoin, **rien de superflu**"
- **6 cartes feature** en grille :
  - ⚡ Campagnes en 1 clic — posts + emails + pubs générés automatiquement
  - 📱 Tous les réseaux — Facebook, Instagram, LinkedIn, email dans un seul outil
  - 🕐 Publication programmée — choix automatique des meilleurs créneaux
  - 🎨 Visuels générés — images et visuels créés par l'IA selon ton branding
  - 📊 Stats en temps réel — portée, engagement, clics, conversions
  - 🌐 100% en français — interface, IA, support, tout en français
- **Style carte :** fond `rgba(255,255,255,0.03)`, bordure subtile, icône dans carré gradient, hover lift + bordure violette
- Stagger reveals `.reveal`

---

### 6. SECTION STATS

- **Fond :** `#08080F` avec glow violet centré
- **4 stats en grille :**
  - ⚡ **10 min** — temps moyen pour lancer une campagne
  - 📱 **4 réseaux** — connectés simultanément
  - 🔄 **24/7** — l'agent travaille pour toi en continu
  - ✅ **100%** — en français, du début à la fin
- **Animation countUp** : les chiffres apparaissent avec scale(0.8→1) via IntersectionObserver
- Séparateurs verticaux subtils entre les stats

---

### 7. SECTION TARIFS

- **Fond :** `linear-gradient(160deg, #08080F, #0F0F1A)`
- **Badge + Titre :** "Un prix simple. Pas de surprise."
- **2 plans côte à côte :**

**Gratuit — 0€/mois**
- 3 campagnes/mois
- 2 réseaux sociaux
- Textes générés par IA
- Bouton : "Commencer gratuitement"

**Pro — 29€/mois** ← BADGE "Recommandé" gradient
- Campagnes illimitées
- Tous les réseaux (Facebook, Instagram, LinkedIn, email)
- Visuels générés par IA
- Publication automatique programmée
- Stats & rapports
- Support prioritaire
- Bouton gradient : "Passer au Pro →"

- Carte Pro : bordure gradient animée, glow violet, léger scale-up, badge "Recommandé" pill magenta

---

### 8. SECTION FAQ (accordion)

- **Fond :** `#0F0F1A`
- **Titre :** "Questions fréquentes"
- **6 questions en accordion** (open/close via useState) :
  1. GrowIQ est-il vraiment en français ?
  2. Est-ce que je dois connecter mes réseaux sociaux ?
  3. Puis-je modifier le contenu généré avant publication ?
  4. Comment fonctionne la génération de visuels ?
  5. Y a-t-il un engagement ou une durée minimale ?
  6. GrowIQ fonctionne pour quel type d'entreprise ?
- Style : fond `rgba(255,255,255,0.03)`, bordure subtile, chevron rotatif (→ rotation 90° quand ouvert), hauteur animée, réponse en `rgba(255,255,255,0.55)`

---

### 9. CTA FINAL

- **Fond :** `#0F0F1A` avec glow radial violet centré
- **Titre :** "Prêt à lancer ta première campagne ?"
- **Sous-titre :** "Rejoins des milliers d'indépendants et de petites entreprises qui économisent des heures chaque semaine avec GrowIQ."
- **Bouton :** "⚡ Lancer gratuitement — sans carte" — gradient, pill, grand (padding 15px 44px), glow renforcé au hover
- **Texte sous le bouton :** "Première campagne prête en moins de 10 minutes."

---

### 10. FOOTER

- **Fond :** `#08080F`
- **Ligne gradient haut :** `linear-gradient(to right, transparent, rgba(91,84,214,0.4), transparent)`
- **3 colonnes :**
  - Colonne 1 (2fr) : logo + description + icônes réseaux sociaux (LinkedIn, Instagram, X)
  - Colonne 2 (1fr) : "PRODUIT" — Fonctionnalités · Tarifs · Lancer une campagne · Mon compte
  - Colonne 3 (1fr) : "LÉGAL" — Mentions légales · CGU · Politique de confidentialité · Contact
- **Hover liens :** couleur `#7B74E8`
- **Copyright :** "© 2025 GrowIQ · growiq.tech · Agent marketing IA en français"

---

## ASSEMBLAGE — LandingPage

```jsx
import { useScrollReveal } from './hooks/useScrollReveal'

export function LandingPage() {
  useScrollReveal()
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#08080F', color: 'white' }}>
      <Navbar />
      <HeroSection />
      <AudienceSection />
      <HowSection />
      <FeaturesSection />
      <StatsSection />
      <PricingSection />
      <FAQSection />
      <CTAFinalSection />
      <Footer />
    </div>
  )
}
```

---

## RÉCAPITULATIF DES EFFETS VISUELS À IMPLÉMENTER

| Effet | Où | Technique |
|---|---|---|
| Typewriter | Hero | useState + useEffect chaîné, lettre par lettre |
| Titre shimmer gradient | Hero h1 | background-clip + animation shimmer 3s |
| Grille de fond | Hero | background-image repeating linear-gradient |
| Glows ambiants | Hero, Stats, CTA | radial-gradient position absolute pointerEvents none |
| Particules flottantes | Hero | animation float + emojis positionnés |
| Navbar glassmorphism | Header au scroll | backdrop-filter + scroll listener |
| Scroll reveal | Toutes sections | IntersectionObserver + classe .visible |
| Hover lift + glow | Toutes les cartes | translateY(-4px) + borderColor transition |
| Barre gradient hover | Cartes Audience | width 0→100% transition |
| Numéros watermark | Section étapes | opacity 6%, font-size 120px, position absolute |
| Compteurs animés | Stats | IntersectionObserver + countUp animation |
| Accordion FAQ | Section FAQ | useState open + height auto transition |
| CTA hover lift | Tous les CTAs | translateY(-2px) + box-shadow intensifié |

---

## VÉRIFICATION FINALE

Après les modifications, vérifie que :
- [ ] `https://growiq.tech/` affiche la nouvelle landing page sombre
- [ ] `https://growiq.tech/app` fonctionne toujours sans aucun changement
- [ ] La navbar est fixed et glassmorphism au scroll
- [ ] L'effet typewriter dans le hero tourne en boucle
- [ ] Toutes les sections ont leur scroll reveal
- [ ] Les boutons CTA pointent bien vers `/app`
- [ ] Le site est responsive mobile (clamp, flexWrap, auto-fill grids)
