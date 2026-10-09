# Chess Hub

Plateforme qui **apprend les échecs** et **s'adapte à chaque joueur** : parcours pour débutants, explication de chaque coup, coach adaptatif (puzzles choisis selon vos points faibles, révision des erreurs de vos propres parties, adversaire qui s'ajuste), sessions entre amis, prof IA (Llama), et **estimation du niveau Elo à partir de vos propres parties**, avec une marge d'erreur mesurée.

Tout le calcul lourd (moteur d'échecs, estimation du niveau) se fait dans le navigateur du joueur : le site coûte presque rien à héberger.

---

## Ce qui le distingue, chiffres à l'appui

| Point | Preuve |
|---|---|
| **Estimation du niveau sur un vrai modèle**, entraîné sur **3 769 parties Lichess classées** (de 600 à 3 000 Elo) | Testé sur des joueurs que le modèle n'a jamais vus : erreur moyenne **362 points sur une partie**, contre 501 pour l'ancienne formule et 604 sans information ([ml/RESULTS.md](ml/RESULTS.md)) |
| **La marge d'erreur est affichée honnêtement** | Le site écrit « probablement entre X et Y » ; l'intervalle vient des mesures, il se resserre quand on analyse plusieurs parties |
| **Mesuré dans les conditions réelles du site** | 200 parties de 40 joueurs exclus de l'entraînement, réanalysées par le moteur du site (Stockfish 18) : erreur moyenne **374** contre 366 avec les analyses de Lichess. L'ancien moteur (Stockfish 10) faussait la mesure : ses évaluations s'écartaient d'environ 50 centipions de celles de Lichess, contre moins de 10 aujourd'hui |
| **Jeu en ligne impossible à truquer** | Chaque coup est vérifié par le serveur ; la pendule, le résultat et l'Elo sont décidés par la base de données, jamais par le navigateur |
| **335 puzzles** (20 faits main + 315 notés de la base Lichess) | Classés par thème et par niveau ; tous rejoués automatiquement par les tests |
| **Vérifié automatiquement** | 99 tests (dont 20 qui jouent contre une vraie base PostgreSQL et tentent de tricher), chaque exercice des leçons rejoué, vérification des puzzles par Stockfish, compilation : à chaque envoi de code ([.github/workflows/ci.yml](.github/workflows/ci.yml)) |

## Fonctionnalités

**Apprendre**
- **Parcours débutant** : 12 leçons interactives sur l'échiquier (déplacement de chaque pièce en ramassant des étoiles, prise, échec, mat, roque, principes d'ouverture, premiers pièges). Un test vérifie que chaque exercice a une solution.
- **Explication de chaque coup** : dans la revue de partie et l'estimation du niveau, chaque coup est expliqué en phrases simples (prise, échec, fourchette, pièce laissée en prise, développement…) avec le meilleur coup du moteur quand il y avait mieux ([src/lib/explain.ts](src/lib/explain.ts)).

**Coach adaptatif** ([src/lib/adaptive.ts](src/lib/adaptive.ts))
- **Profil d'apprentissage** : niveau estimé et son évolution, classement puzzles, style de jeu, 3 points faibles, prochain entraînement conseillé.
- **Puzzles pour moi** : un classement puzzle (formule Elo) mis à jour à chaque puzzle ; les puzzles suivants sont choisis un peu au-dessus de ce classement, et 6 fois sur 10 sur un thème faible.
- **Revoir mes erreurs** : les erreurs de vos parties deviennent des exercices, avec répétition espacée (1, 3, 7 puis 21 jours ; une erreur ratée revient tout de suite). Un autre coup que celui du moteur est accepté s'il garde l'avantage (vérifié par Stockfish).
- **Adversaire qui s'ajuste** : le niveau « Auto » de l'ordinateur monte quand vous gagnez et baisse quand vous perdez.

**À plusieurs** ([supabase-migration-v5.sql](supabase-migration-v5.sql))
- **Défier un ami** par lien ou code à 6 caractères : partie amicale ou **d'entraînement** (chacun peut demander un conseil au coach), sans changement d'Elo.
- **Duel de puzzles** : les mêmes puzzles pour les deux, un seul essai, le plus de puzzles résolus gagne (le plus rapide en cas d'égalité).
- **Salle d'étude** : un échiquier partagé en direct, chaque membre peut jouer et revenir en arrière, avec l'avis du coach.

**Prof IA** (Llama 3.3 via Groq, [api/coach.ts](api/coach.ts))
- Bilan de partie, réponses aux questions pendant les leçons, bilan personnalisé avec un plan pour la semaine.
- Le navigateur n'envoie que des données d'échecs ; le texte envoyé au modèle est écrit par le serveur ([server/aiPrompts.ts](server/aiPrompts.ts)), avec l'analyse de Stockfish, pour que l'IA n'invente pas de coups. Réservé aux joueurs connectés, avec une limite par jour.

**Jouer**
- Contre Stockfish 18, 5 niveaux ou « Auto » (s'adapte à vous), pendule, retour en arrière, promotion au choix, revue de la partie avec l'avis du moteur.
- En ligne (avec un compte) : recherche d'adversaire de niveau proche (l'écart accepté s'élargit avec l'attente), pendule 10 min + 2 s par coup, chat, classement Elo, reprise d'une partie après rechargement de la page, annulation d'une partie jamais commencée.

**Deux langues** : tout le site existe en français et en anglais (bouton FR / EN en haut à droite). En français, les coups s'écrivent en notation française (Cf3, Fb5…).

**Progression sauvegardée** : dans le navigateur, et sur le compte quand on est connecté (on la retrouve sur un autre appareil, les deux progressions sont fusionnées sans rien perdre).

**Progresser (coach)**
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
2. Dans l'éditeur SQL, exécutez **dans cet ordre** : `supabase-setup.sql`, `supabase-migration-v2.sql`, `supabase-migration-v3.sql`, `supabase-migration-v4.sql` (sauvegarde de la progression sur le compte), `supabase-migration-v5.sql` (sessions entre amis, limite du prof IA).
3. Copiez `.env.example` en `.env` et remplissez les trois valeurs (Project Settings → API) :
   ```env
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # secrète : utilisée seulement par le serveur (/api/move, /api/coach)
   GROQ_API_KEY=...                # facultative : active le prof IA (clé gratuite sur console.groq.com)
   ```
4. `npm run dev` : les fonctions serveur `/api/move` et `/api/coach` tournent aussi en local.

### 3. Mise en ligne sur Vercel

1. Importez le dépôt GitHub dans Vercel (projet Vite détecté automatiquement).
2. Ajoutez les variables d'environnement ci-dessus dans Settings → Environment Variables.
3. Déployez. Le dossier `api/` devient automatiquement une fonction serveur.

## Vérifier le projet

```bash
npm test                 # 99 tests : coups côté serveur, base de données (PostgreSQL embarqué), leçons, explications, coach adaptatif, prof IA, analyse, modèle Elo, puzzles
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

## Structure

```
api/move.ts               fonction serveur Vercel : vérifie et enregistre un coup en ligne
api/coach.ts              fonction serveur Vercel : prof IA (Llama via Groq), limite par jour
server/aiPrompts.ts       textes envoyés à l'IA, écrits côté serveur (testés)
src/data/lessons.ts       parcours débutant (12 leçons)
src/lib/explain.ts        explication des coups en phrases simples
src/lib/adaptive.ts       coach adaptatif : classements, points faibles, choix des puzzles, révision des erreurs
src/lib/together.ts       défis entre amis, duels de puzzles, salles d'étude
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
