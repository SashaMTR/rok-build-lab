# RoK Build Lab

Petit site local (HTML/CSS/JS, **zéro dépendance**) pour retrouver les builds des commandants
de *Rise of Kingdoms* en fonction de **ta** collection, avec les duos et les marches possibles.

## Lancer le site

**Windows, sans rien installer (recommandé) :**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serve.ps1
# puis ouvrir http://localhost:5173
```

**Avec Node.js** (installé en portable dans `%LOCALAPPDATA%\nodejs`, ajouté au PATH utilisateur) :

```bash
npm run serve
# puis ouvrir http://localhost:5173
```

Ouvre un **nouveau terminal** après l'installation pour que `node`/`npm` soient reconnus.

Tu peux aussi ouvrir `index.html` directement (double-clic) : tout fonctionne, sauf le bouton
« Actualiser les données » qui a besoin du petit serveur local.

## Déployer sur GitHub Pages

Le site est 100 % statique et utilise des chemins relatifs : il fonctionne tel quel dans un
sous-dossier GitHub Pages (`https://<utilisateur>.github.io/<repo>/`).

Les fichiers de déploiement sont déjà prêts :
- `.github/workflows/pages.yml` : déploie le site à chaque push sur `main` ;
- `.github/workflows/update.yml` : met à jour les données chaque dimanche et redéploie ;
- `.nojekyll` : évite le traitement Jekyll.

### 1. Installer Git et créer le dépôt

```powershell
winget install --id Git.Git -e --source winget
```

Crée ensuite un dépôt **public** vide sur GitHub (sans README), puis dans le dossier du projet :

```powershell
git init
git add .
git commit -m "RoK Build Lab"
git branch -M main
git remote add origin https://github.com/<utilisateur>/<repo>.git
git push -u origin main
```

> `.env` est ignoré par Git : le token Discord ne sera jamais publié. Ne le force jamais avec
> `git add -f .env`.

### 2. Activer GitHub Pages

Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
Le workflow `Deploy to GitHub Pages` se lance alors et le site est accessible à :

```
https://<utilisateur>.github.io/<repo>/
```

### 3. Mises à jour automatiques

Le workflow `Update RoK data` tourne chaque **dimanche à 07:30 UTC** (≈ 09:30 Paris en été) :
il récupère les talents + commandants (RokBuilder/RokStats), régénère les fichiers `data/*.js`,
commit les changements et redéploie le site. Tu peux aussi le lancer manuellement depuis
l'onglet **Actions → Update RoK data → Run workflow**.

Les codes cadeaux restent mis à jour par les scripts locaux (`scripts\fetch-codes.ps1`) ; ils
peuvent aussi être édités à la main dans `data/content.json`.

## Fonctionnalités

- **Sélection** : catalogue filtrable (recherche, rareté, troupes, grade) et **triable** par nom, grade, tier, type de troupe, rareté, build officiel ou possession ; portraits et cases à cocher sauvegardées dans le navigateur.
- **Rôles automatiques** : le site attribue un rôle à chaque commandant à partir de ses spécialités (nuke, tank, soutien, farm, récolteur, coursier, rally…) et génère le build correspondant s'il n'y a pas de build écrit à la main (`trees: []`).
- **Mes builds** : pour chaque commandant possédé → rôle attribué, **arbre de talents réel** (les arbres du commandant qui ont des points ; chemin du build officiel en doré, ou chemin conseillé repris d'un build officiel partageant les mêmes arbres), 1er talent, compétences, équipement, notes. Pour les commandants sans build officiel, un sélecteur **PvP / Farm / Barbares / Garnison** permet de voir le chemin adapté (ex. Jeanne : PvP = Soutien, Farm = Récolte).
- **Qui améliorer ?** : un **noyau prioritaire limité** (5 commandants ou plus selon la collection) qui couvre le farm, le PvP et le Path of Vengeance — au lieu des catégories « selon ton besoin / à ne pas investir ». Les builds du noyau sont affichés en premier.
- **Mes compos** : les **3 meilleures marches** calculées avec ta collection (farm, barbares, PvP), les duos qui fonctionnent et les commandants « à viser ».
- **Analyse des compétences** : les descriptions des skills (RokStats) sont lues pour calculer un profil **dégâts / tank / soutien / debuff / rage** ; combiné aux arbres de talents, ce profil sert à construire le board Path of Vengeance et la meilleure marche PvP (au lieu de se limiter au tier).
- **Critères de composition** : Damage Factor, monocible/AoE, rage, buffs self/équipe, soins, boucliers, réduction de dégâts, debuffs, contrôle, contexte **primary/secondary/garrison**, arbres de talents, bonus **anti-barbares/Peacekeeping**, synergies **officielles** (Field / Peacekeeping / Gathering / Garrison), synergie de troupe, et coût de rareté dans « Qui améliorer ? ».
- **Compo Path of Vengeance** : les 5 commandants de ta collection placés par position (avant / milieu / arrière).
- **Codes** : liste vérifiée avec date, statut (actif / à tester), expiration et copie en un clic. Les codes expirés sont masqués.
- **Boutique** : classement des packs payants (S / A / B), plans par budget (0 / 5 / 10 / 15 €) et liste de ce qu'il faut éviter.
- **Technologie** : **arbre visuel** (militaire + économique) avec les branches réelles, puis chemins de recherche prioritaires (économie, cavalerie, infanterie, archers, fin de jeu).
- **Plans de base** : schémas par tranche d'HDV (1-5, 6-10, 11-15, 16-20, 21-25) + **galerie d'images** de dispositions.
- **Interface mobile** : filtres, builds, compos, arbre technologique et galeries s'adaptent au téléphone (l'arbre techno passe en défilement horizontal pour rester lisible).
- **Version des données** affichée en haut et en bas ; bouton de vérification de mise à jour.

## Lancer le jeu / inspecter l'installation

```powershell
# détecte l'installation et lance le launcher
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launch-rok.ps1

# lance directement le jeu (MASS.exe)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launch-rok.ps1 -Game

# affiche seulement les chemins (aucun lancement)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launch-rok.ps1 -DryRun

# capture l'écran 10 s après le lancement
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launch-rok.ps1 -Screenshot

# inspecte les dossiers de données (lecture seule)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\inspect-rok.ps1
```

Le client est en Unity/IL2CPP : les données de jeu sont dans ~1 186 bundles `.lb`
propriétaires (~5 Go), pas dans des fichiers JSON lisibles. Le site utilise donc le dataset
communautaire `data/commanders.json` (et non une extraction du client).

## Mettre à jour les codes

```powershell
# 0) ajouter/mettre à jour un seul code, sans bot
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\add-code.ps1 -Code aqmxqk92hj -Expires "2026-11-08 16:59" -Rewards "Code Discord"

# 1) un code par ligne dans un fichier texte
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-codes.ps1 -File codes.txt

# 2) depuis Discord (API bot officielle)
$env:DISCORD_BOT_TOKEN = "..."
$env:DISCORD_CHANNEL_ID = "..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-codes.ps1

# 3) depuis une page publique
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-codes.ps1 -Url "https://exemple.com/codes"

# tester sans écrire
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-codes.ps1 -File codes.txt -DryRun

# diagnostiquer l'accès du bot (token, serveur, salon) sans afficher le token
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\diagnose-discord.ps1

# récupération automatique depuis une page publique (nouveaux codes en "unknown")
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fetch-codes.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fetch-codes.ps1
```

### Synchronisation Discord (site + GitHub Pages)

Le navigateur ne contacte **jamais** Discord directement : le token du bot reste côté serveur
(local ou GitHub Actions).

```powershell
# local : lit .env (DISCORD_BOT_TOKEN / DISCORD_CHANNEL_ID)
npm run update:codes

# ou directement
node scripts/fetch-discord-codes.mjs --dry-run
node scripts/fetch-discord-codes.mjs
```

- Une tâche planifiée Windows **`RoK Codes Discord`** exécute ce script chaque jour à **09:05**.
- Sur GitHub Actions, le workflow **`Update codes from Discord`** tourne chaque jour à 06:00 UTC
  (≈ 08:00 Paris) et redéploie le site.
- Ajoute les secrets du dépôt : **`DISCORD_BOT_TOKEN`** et **`DISCORD_CHANNEL_ID`**
  (Settings → Secrets and variables → Actions).
- Les codes récents sans expiration sont ajoutés en `active` ; les codes anciens ou sans date
  sont ajoutés en `unknown` (masqués par défaut, visibles avec le toggle « à tester »).
- Les messages contenant « expired / expiré / invalid » sont ignorés.

> **Sécurité** : ne mets jamais le token dans le dépôt ni dans le site. Si un token a été exposé,
> régénère-le dans le portail Discord Developer, puis mets à jour `.env` et le secret GitHub.
> `.env` est ignoré par Git.

Une tâche planifiée Windows **`RoK Codes Auto`** exécute `fetch-codes.ps1` chaque jour à 09:00
(visible dans le Planificateur de tâches). Les codes importés arrivent en `unknown` : affiche-les
avec le toggle « à tester » ou passe-les en `active` avec `-Status active`.

## Données de jeu (commandants)

`scripts/fetch-commander-data.mjs` importe automatiquement depuis **rokbuilder.com** :

- les **builds officiels** (talents + points + arbres),
- le **tier**, les **pairings** et les **compétences**,
- les **portraits** dans `assets/img/<id>.webp`.

```bash
node scripts/fetch-commander-data.mjs --dry-run --limit 5
node scripts/fetch-commander-data.mjs
node scripts/fetch-commander-data.mjs --only sun-tzu

node scripts/fetch-talents.mjs   # géométrie + données des arbres
```

Les champs manuels (`role`, `roleKey`, `invest`, `skillOrder`, `notes`) sont conservés.
Les commandants sans build officiel gardent un build généré (`trees: []`).

Le site affiche désormais :
- le **vrai arbre de talents** (géométrie réelle, nœuds du build officiel en doré) ;
- les **grades détaillés** (Global, Champ, Rally, Garnison, Canyon) ;
- l'**équipement recommandé** (6 pièces, à farmer) ;
- les **compétences** et les **portraits** (256×320).

Une tâche planifiée Windows **`RoK Commander Data`** exécute `scripts/update-all.ps1` chaque
**dimanche à 09:30** (talents + commandants + rebuild). La tâche **`RoK Codes Auto`** met à jour
les codes chaque jour à 09:00.

## Sources des données

- **Commandants, builds officiels, grades, compétences, portraits** : [rokbuilder.com](https://rokbuilder.com)
  (données du client via [rokstats.online](https://app.rokstats.online/), valeurs via
  [gacha-data.com](https://gacha-data.com/rise-of-kingdoms/)).
- **Descriptions et analyse des compétences** : dossiers JSON de [RokStats](https://app.rokstats.online/).
- **Synergies officielles** : paires recommandées du jeu (RokStats), avec leur scénario (Field, Peacekeeping, Garrison, Gathering).
- **Géométrie des arbres de talents** : [thesimonho/rok-talents](https://github.com/thesimonho/rok-talents) (GPL-3.0).
- **Codes** : ton salon Discord `#codes` (via l'API bot, synchronisation locale/GitHub Actions) et [riseofkingdomsguides.com](https://riseofkingdomsguides.com/redeem-codes/) pour la page publique.
- **Portraits** : © Lilith Games, via RokBuilder.

> Les données sont lues depuis les tables du client par les sites communautaires ; ce projet
> ne décode pas les bundles du jeu et ne contourne aucune protection.

## Encodage

Tous les JSON sont en **UTF-8**. Les scripts PowerShell lisent explicitement l'UTF-8
(`[System.IO.File]::ReadAllText(..., [Text.Encoding]::UTF8)`) pour éviter le mojibake CP1252.
Après chaque écriture, `build-data.ps1` normalise `data/content.json` via Node
(`scripts/normalize-json.mjs`).

**Discord** : crée une application sur <https://discord.com/developers/applications>, active
**Message Content Intent**, invite le bot sur le serveur (scope `bot`, permission
*Read Message History*), active le mode développeur, clic droit sur `#redeem-code` →
*Copier l'identifiant du salon*.

Le plus pratique : copie `.env.example` en `.env` à la racine et remplis
`DISCORD_BOT_TOKEN` et `DISCORD_CHANNEL_ID`. Le script lit ce fichier automatiquement.
`.env` est ignoré par git (ne le partage jamais).
Le serveur officiel peut refuser les bots. Trois solutions :
- **le plus simple** : copie-colle les codes dans un `.txt` et utilise `-File` ;
- **ton propre serveur** : crée un serveur Discord, invite le bot, crée un salon `#codes`,
  recopie les codes depuis le salon officiel, puis utilise l'ID de **ton** salon ;
- **`-Url`** : pointe vers une page publique qui liste les codes.

Le script parcourt jusqu'à `-Limit` messages (300 par défaut), accepte les codes avec ou sans
chiffres, et n'utilise que l'API bot officielle (pas de token utilisateur).

## Codes, boutique, techno, plans de base

Ces contenus vivent dans `data/content.json` et sont régénérés dans `data/content.js` par
`scripts/build-data.ps1` (ou `npm run update`).

- **Codes** : chaque entrée a un `status` (`active` / `unknown` / `expired`) et éventuellement une
  date `expires` (`AAAA-MM-JJ`). Le site masque automatiquement les codes expirés et affiche
  « à tester » pour ceux dont l'expiration n'est pas connue. La date de vérification est affichée
  dans l'onglet Codes.
- **Boutique** : liste classée par intérêt (`rank`), avec prix, contenu, raison et budget conseillé.
- **Technologie** : chemins ordonnés par objectif (`paths[].steps`).
- **Plans de base** : un schéma par tranche d'HDV (`layouts.brackets`), avec zones hors muraille,
  muraille, intérieur et cœur de ville.

> Les codes expirent très vite et changent souvent : la liste est un instantané vérifié à la date
> indiquée. Pour la rafraîchir, mets à jour `data/content.json` puis relance le build.

## Portraits

Les images sont stockées localement dans `assets/img/<id>.webp` (id du commandant). Le site affiche
l'image si elle existe, sinon un avatar avec les initiales.

Pour ajouter un portrait : dépose `assets/img/<id>.webp` (ou `.png`/`.jpg` en adaptant le chemin).
Les portraits appartiennent à Lilith Games ; ils sont ici utilisés dans un outil fan non commercial.

## Mettre à jour les données

Le site lit `data/commanders.json` (source de vérité) et `data/commanders.js` (version chargée par la page).

**Windows, sans rien installer :**

```powershell
# après avoir édité data/commanders.json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-data.ps1
```

**Avec Node.js (nécessaire pour tirer une source distante) :**

```bash
# 1) après avoir édité data/commanders.json
npm run update

# 2) depuis une source JSON distante (qui respecte le même schéma)
npm run update -- --source https://exemple.com/rok-builds.json

# 3) vérifier si une version plus récente existe
npm run check -- --source https://exemple.com/rok-builds.json
```

Variables : `ROK_SOURCE_URL` (équivalent de `--source`), `--no-bump` (ne pas changer la version).

### Mise à jour « automatique »

RoK n'expose pas d'API publique fiable : un site purement statique ne peut pas deviner les
nouveaux commandants tout seul. Le mécanisme prévu est donc :

1. tu (ou une communauté) maintiens un **JSON** au même format ;
2. une tâche planifiée exécute `npm run update -- --source <URL>` ;
3. les fichiers de données sont régénérés, le site les sert à jour.

Un workflow GitHub Actions est fourni (`.github/workflows/update.yml`) : ajoute le secret
`ROK_SOURCE_URL`, active GitHub Pages, et le site se mettra à jour tout seul chaque jour.
En local, tu peux planifier `npm run update` avec le Planificateur de tâches Windows.

Sans source distante, `npm run update` régénère simplement le fichier JS depuis le JSON local.

## Ajouter / modifier un commandant

Dans `data/commanders.json`, ajoute un objet dans `commanders` :

```json
{
  "id": "mon-commandant",
  "name": "Mon Commandant",
  "rarity": "legendaire",
  "troops": "cavalerie",
  "specialities": ["Cavalerie", "Compétence", "Attaque"],
  "role": "Nuke cavalerie",
  "roleKey": "nuker",
  "tier": "A",
  "firstTalent": "Rejuvenate",
  "trees": [
    { "name": "Compétence", "path": ["Burning Blood", "All For One", "Rejuvenate"] },
    { "name": "Cavalerie", "path": ["Emblazoned Shield", "Dragon Saber", "Undying Fury"] }
  ],
  "skillOrder": "Comp 1 à 5 avant les étoiles, puis 2★/4★.",
  "equipment": "Set cavalerie.",
  "notes": "…",
  "pairings": ["cao-cao"],
  "usage": ["pvp", "barbares"],
  "verified": false
}
```

Puis `npm run update` pour régénérer `data/commanders.js`.

- `rarity` : `legendaire` | `epique` | `elite` | `avance`
- `troops` : `cavalerie` | `infanterie` | `archers` | `polyvalent` | `siege`
- `usage` : `pvp` | `barbares` | `forts` | `garnison` | `ralliement` | `recolte` | `xp` | `utilitaire`
- `verified` : `true` = build recoupé sur des guides, `false` = recommandation générique par rôle.
- `roleKey` (optionnel) : force le rôle attribué (`nuker`, `damage`, `tank`, `support`, `peacekeeper`, `peace_support`, `gatherer`, `support_gather`, `runner`, `rally`, `generic`).
- `trees: []` : laisse le site **générer** le build automatiquement à partir du rôle.

## Avertissement

Outil communautaire non officiel, non affilié à Lilith Games. Les builds sont indicatifs :
la méta de Rise of Kingdoms change à chaque mise à jour. Vérifie toujours dans le jeu.
