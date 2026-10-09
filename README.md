# Chess Hub

Site d'échecs qui sert à **jouer et à progresser** : parties contre Stockfish, parties classées en ligne, entraînement tactique, et **estimation du niveau Elo à partir de vos propres parties**, avec une marge d'erreur mesurée.

Tout le calcul lourd (moteur d'échecs, estimation du niveau) se fait dans le navigateur du joueur : le site coûte presque rien à héberger.

---

## Ce qui le distingue, chiffres à l'appui

| Point | Preuve |
|---|---|
| **Estimation du niveau sur un vrai modèle**, entraîné sur **3 769 parties Lichess classées** (de 600 à 3 000 Elo) | Testé sur des joueurs que le modèle n'a jamais vus : erreur moyenne **362 points sur une partie**, contre 501 pour l'ancienne formule et 604 sans information ([ml/RESULTS.md](ml/RESULTS.md)) |
| **La marge d'erreur est affichée honnêtement** | Le site écrit « probablement entre X et Y » ; l'intervalle vient des mesures, il se resserre quand on analyse plusieurs parties |
| **Même moteur qu'à l'entraînement** | Stockfish 18 dans le navigateur : ses évaluations s'écartent de moins de 10 centipions de celles de Lichess (l'ancien Stockfish 10 s'en écartait de 50) |
| **Jeu en ligne impossible à truquer** | Chaque coup est vérifié par le serveur ; la pendule, le résultat et l'Elo sont décidés par la base de données, jamais par le navigateur |
| **335 puzzles** (20 faits main + 315 notés de la base Lichess) | Classés par thème et par niveau ; tous rejoués automatiquement par les tests |
| **Vérifié automatiquement** | 21 tests, vérification des puzzles par Stockfish, compilation : à chaque envoi de code ([.github/workflows/ci.yml](.github/workflows/ci.yml)) |

## Fonctionnalités

**Jouer**
- Contre Stockfish 18, 5 niveaux, pendule, retour en arrière, promotion au choix, revue de la partie avec l'avis du moteur.
- En ligne (avec un compte) : recherche d'adversaire de niveau proche (l'écart accepté s'élargit avec l'attente), pendule 10 min + 2 s par coup, chat, classement Elo, reprise d'une partie après rechargement de la page, annulation d'une partie jamais commencée.

**Progresser (AI Coach)**
- **Elo Prediction** : importez vos 1, 3, 5 ou 10 dernières parties Lichess ou Chess.com (ou collez des PGN). Le site analyse chaque coup, estime votre niveau, affiche la marge d'erreur, votre précision par phase de jeu et vos erreurs clés. Pour les parties importées, il affiche aussi le vrai classement à côté de l'estimation.
- **Tactic Trainer** : 335 puzzles, 7 thèmes, 3 niveaux, indices, solution animée, séries.
- **Position Trainer** : choisir le bon coup dans des positions d'ouverture types.
- **Game Rewinder** : revoir une partie coup par coup avec la qualité de chaque coup.

## Sécurité du jeu en ligne

Le navigateur ne peut que **lire** les parties. Tout ce qui les modifie passe par le serveur :

| Action | Qui décide | Où |
|---|---|---|
| Jouer un coup | Le serveur rejoue la partie avec chess.js et refuse tout coup illégal ou joué hors de son tour | [api/move.ts](api/move.ts), [server/onlineMove.ts](server/onlineMove.ts) |
| Mat, pat, nulle | Le serveur, pas le joueur | idem |
| Temps écoulé | L'horloge de la base de données | `claim_timeout` dans [supabase-migration-v3.sql](supabase-migration-v3.sql) |
| Créer une partie | Le matchmaking de la base, avec le vrai classement du joueur | `join_queue` |
| Changer l'Elo | Une fonction qu'aucun joueur ne peut appeler | `finish_game_internal` |
| Adresses e-mail | Invisibles pour les autres joueurs | droits par colonne sur `profiles` |

## Installation

### 1. En local, sans base de données (le plus simple)

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000. Jeu contre l'ordinateur, entraînement et prédiction Elo fonctionnent. Le jeu en ligne et le classement sont désactivés (le site l'indique clairement).

### 2. Avec le jeu en ligne (Supabase)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL, exécutez **dans cet ordre** : `supabase-setup.sql`, `supabase-migration-v2.sql`, `supabase-migration-v3.sql`.
3. Copiez `.env.example` en `.env` et remplissez les trois valeurs (Project Settings → API) :
   ```env
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # secrète : utilisée seulement par le serveur (/api/move)
   ```
4. `npm run dev` : la fonction serveur `/api/move` tourne aussi en local.

### 3. Mise en ligne sur Vercel

1. Importez le dépôt GitHub dans Vercel (projet Vite détecté automatiquement).
2. Ajoutez les trois variables d'environnement ci-dessus dans Settings → Environment Variables.
3. Déployez. Le dossier `api/` devient automatiquement une fonction serveur.

## Vérifier le projet

```bash
npm test                 # 21 tests : contrôle des coups côté serveur, analyse, modèle Elo, puzzles
npm run verify:puzzles   # chaque puzzle fait main est vérifié par Stockfish
npm run build            # vérification des types + build de production
```

## Le modèle Elo : comment il est fait

Tout est reproductible avec les scripts du dossier [ml/](ml/) :

```bash
node ml/collect-lichess.mjs              # 1. télécharge des parties classées déjà analysées par Lichess (API publique)
npx vite-node ml/build-features.ts       # 2. calcule les indicateurs avec le MÊME code que le site
python ml/train.py                       # 3. entraîne, mesure, exporte src/data/eloModel.json et ml/RESULTS.md
npx vite-node ml/browser-engine-check.ts # 4. refait l'analyse avec le moteur du site, pour mesurer en conditions réelles
```

- **Ce que le modèle regarde** : la perte moyenne par coup, la précision, les erreurs dans les positions encore équilibrées, la qualité de l'ouverture, et la qualité de jeu de l'adversaire (on joue en général contre quelqu'un de son niveau).
- **Ce qu'il ne regarde pas exprès** : la cadence de jeu. Dans notre échantillon, elle dépendait de la façon dont les joueurs ont été trouvés et gonflait artificiellement les scores. Elle est donc exclue.
- **Mesure honnête** : validation croisée par joueur. Les joueurs testés ne sont jamais vus pendant l'entraînement.
- **Le site et Python donnent les mêmes nombres** : un test le vérifie ([tests/eloModel.test.ts](tests/eloModel.test.ts)).

### Limites connues

- Une seule partie contient peu d'information : l'estimation reste large (environ ±600 points pour 80 % des cas). Elle se resserre avec plusieurs parties, mais un écart propre à chaque joueur subsiste (environ ±450 avec 10 parties).
- L'estimation est un classement « style Lichess », plus élevé que le classement FIDE pour la plupart des joueurs.
- La progression d'entraînement est gardée dans le navigateur (pas encore sur le compte).

## Structure

```
api/move.ts               fonction serveur Vercel : vérifie et enregistre un coup en ligne
server/onlineMove.ts      règle de vérification d'un coup (testée)
src/lib/analysis.ts       analyse Stockfish d'une partie (précision, perte par coup)
src/lib/eloFeatures.ts    indicateurs d'une partie (partagés par le site et l'entraînement)
src/lib/eloModel.ts       prédiction Elo dans le navigateur
src/data/                 puzzles, positions, modèle Elo exporté
ml/                       collecte, entraînement et mesures du modèle
supabase-*.sql            base de données, droits et fonctions serveur
tests/                    tests automatiques
```

## Licence et crédits

Logiciel libre sous **GNU GPL v3** ([LICENSE](LICENSE)), licence imposée par Stockfish.

- Moteur : [Stockfish 18](https://stockfishchess.org) (GPL v3), version WebAssembly de Nathan Rugg / Chess.com
- Pièces : « cburnett » de Colin M.L. Burnett (CC BY-SA 3.0)
- Puzzles notés : [base de puzzles Lichess](https://database.lichess.org/#puzzles) (CC0)
- Parties d'entraînement du modèle : API publique de [Lichess](https://lichess.org)
- Logique d'échecs : [chess.js](https://github.com/jhlywa/chess.js) (BSD-2)
