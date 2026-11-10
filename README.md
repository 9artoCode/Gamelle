# 🍲 Gamelle & Panier

Une application moderne, saine et épurée conçue sur-mesure pour **les couples actifs qui cuisinent pour 4 portions** (2 dîners le soir + 2 gamelles le lendemain midi) et font leurs courses physiques à **Grand Frais**.

---

## ✨ Points forts & Fonctionnalités

1. **⚡ Synchronisation Automatique en Direct (Foyer Partagé)** :
   - Finis les transferts manuels de listes ! Entrez simplement un **Code Foyer** (utilisez « Générer un code sécurisé ») sur vos deux iPhones.
   - Si votre compagne ajoute une recette maison, elle apparaît instantanément sur votre téléphone.
   - Si vous cochez un article dans le rayon boucherie à Grand Frais, il est barré en direct sur son écran dans le rayon légumes !
2. **⭐ Studio de Recettes Maison Personnalisées** :
   - Ajoutez facilement vos propres recettes avec titre, temps, catégorie, saison et photo studio ou URL.
   - Détection automatique et classement intelligent de chaque ingrédient dans les 6 rayons officiels Grand Frais.
   - Détection automatique des temps de cuisson pour créer les minuteurs interactifs pas-à-pas.
   - Modification et suppression en 1 clic.
3. **305 Meilleures Recettes Gourmandes (Inspirées des Stars de Jow)** :
   - Grand catalogue équilibré et varié avec mise à l'honneur spéciale de la **volaille et du poulet** (90 recettes savoureuses : sauté, wok, rôti, curry, laqué, tandoori, tacos, etc.), sans excès de saumon.
   - Toutes notées au sommet (100k à 190k likes), 100% complètes, rapides (< 15 à 30 min) et sans fioritures.
   - Photos studio HD authentiques.
4. **🔒 Gestion des repas restants (« Déjà à la maison » / Garder)** :
   - Il vous reste 1 ou 2 repas non cuisinés en fin de semaine ? Cliquez sur le bouton **« 🔒 Garder / Déjà à la maison »** sur n'importe quel plat du planning.
   - Ces repas restent dans votre menu pour la semaine à venir, mais **leurs ingrédients sont automatiquement exclus de votre liste de courses pour le week-end**.
   - Lorsque vous cliquez sur « Générer un menu », vos repas gardés sont préservés et seuls les nouveaux repas nécessaires sont ajoutés !
5. **Dose automatique x4** : Fixée d'office pour 4 portions (2 pour le soir + 2 pour la boîte du midi), ajustable de 1 à 12 parts en un clic (+ / -).
6. **Rayons Grand Frais fidèles au magasin** :
   - 🥦 *Fruits & Légumes* (hall d'entrée)
   - 🥩 *Boucherie & Volailles*
   - 🐟 *Poissonnerie & Marée*
   - 🧀 *Fromagerie & Crèmerie*
   - 🥫 *Épicerie d'ici et d'ailleurs*
   - 🛒 *Articles courants & Maison* (raccourcis rapides : bananes, lait, fruits de saison, kéfir, yaourts, pain de mie, flocons d'avoine)
7. **Mode Cuisine Pas-à-Pas (Style Jow)** :
   - Instructions grand format
   - Ingrédients précis nécessaires pour chaque étape
   - Minuteur interactif avec alerte sonore
   - Maintien de l'écran allumé (Wake Lock)

---

## 🚀 Comment l'utiliser & Synchroniser votre couple

### 1. Sur votre ordinateur
* Double-cliquez simplement sur **`Lancer_Application.bat`**
* Le serveur démarre et ouvre automatiquement l'application dans votre navigateur.

### 2. Sur vos deux iPhones (Installation PWA permanente)
1. Ouvrez l'adresse de l'application dans **Safari**.
2. Appuyez sur le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisissez **« Sur l'écran d'accueil »**.
4. L'icône de l'application s'installe sur votre iPhone comme une vraie application de l'App Store !

### 3. Activer la synchronisation en direct entre vous deux
1. Rendez-vous dans l'onglet **« Réglages »** sur votre iPhone.
2. Dans le bloc **« Synchronisation en Direct (Foyer) »**, entrez votre code partagé (ex: `FOYER-7K2M-9QXD-4TNB`) et appuyez sur **Connecter**.
3. Faites de même sur l'iPhone de votre compagne avec le même code (ou envoyez-lui votre lien magique qui la connectera automatiquement).
4. Le voyant vert **« Foyer actif »** s'allume en haut de l'écran : tout est synchronisé en direct en temps réel !

## Mise en ligne (GitHub Pages)
Le dossier est un site statique : aucun build nécessaire. Dans le dépôt GitHub : **Settings → Pages → Deploy from a branch → `main` / root**.
`tailwind.css` est le CSS pré-compilé (l'app fonctionne hors-ligne et sans CDN).

## Nouveautés « premium »
- Fonctionne hors-ligne (service worker, photos mémorisées), mise à jour proposée par une pastille.
- Toutes les actions destructrices sont annulables (bouton « Annuler »), fenêtres de confirmation intégrées.
- Données de synchro/partage validées (aucun code injectable), stockage résistant aux données corrompues.
- Codes foyer sécurisés générés automatiquement ; QR code affiché seulement à la demande.
- Catalogue de 300+ plats affiché progressivement, ingrédients regroupés dans la liste de courses.
