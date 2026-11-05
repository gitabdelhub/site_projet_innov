# Chess Hub

Plateforme d'entraînement aux échecs avec IA (projet d'innovation ENSIAS).

**L'innovation** : notre propre modèle de machine learning prédit l'Elo d'un joueur à partir de ses parties, puis le coach lui sert des puzzles calés sur ce niveau.

```
Jouer (ou coller un PGN)  ->  Analyse Stockfish  ->  Elo prédit par notre modèle  ->  Puzzles adaptés  ->  Progression
```

Tout le parcours solo fonctionne **sans aucun service externe** : moteur, analyse, modèle Elo, puzzles et progression tournent dans le navigateur. Supabase n'est utilisé que pour les comptes et le jeu en ligne, et le site ne casse jamais s'il est absent.

---

## Lancer en local (plan B pour la soutenance)

Prérequis : Node.js 18+ et Python 3.10+.

```bash
npm install
pip install -r ml_backend/requirements.txt
npm run local
```

`npm run local` lance **le site** (http://localhost:3000) **et l'API Elo** (http://localhost:5000) en une seule commande. Ctrl+C arrête les deux.

- Sans Python, le site fonctionne quand même : la prédiction se fait dans le navigateur avec le même modèle.
- Aucune connexion Internet n'est nécessaire une fois `npm install` fait (polices, moteur, modèle et puzzles sont embarqués).
- Pour que l'API charge le fichier d'origine `modele_elo.joblib` au lieu de son export JSON : le copier à la racine du projet, puis `pip install -r ml_backend/requirements-full.txt`. `GET /api/health` indique alors `"method": "ml_model_joblib"`. Le résultat est identique.

Autres commandes : `npm run dev` (site seul), `npm run api` (API seule), `npm run build` puis `npm run preview` (version de production).

---

## Fonctionnalités

| Parcours | Ce qui se passe |
|---|---|
| **Jouer contre l'ordinateur** | Stockfish 19 (WebAssembly), 9 niveaux de ~400 à ~2400, choix de la couleur, reprise de coup, promotion au choix, glisser-déposer. La partie en cours survit à un rafraîchissement. |
| **Analyse de partie (Game Rewinder)** | Analyse Stockfish réelle de chaque position (profondeur 14) : précision par joueur, imprécisions, erreurs, gaffes, meilleur coup, courbe d'évaluation, navigation au clavier. |
| **Upload PGN** | Coller une partie ou importer un fichier `.pgn` : analyse coup par coup et Elo prédit pour le camp choisi. Un fichier de plusieurs parties (export Lichess ou Chess.com) donne un profil complet du joueur. |
| **Elo prédit** | Notre modèle (voir plus bas), exécuté dans le navigateur, sur le profil du joueur : chaque partie jouée sur le site s'ajoute aux précédentes. L'API Flask donne le même résultat côté serveur. |
| **Puzzles adaptés** | Extrait de la base ouverte Lichess, choisis autour de l'Elo prédit, filtrables par thème, avec indice, solution et classement puzzle. |
| **Progression** | Elo prédit dans le temps, parties, réussite par thème, thèmes à travailler. Sauvegardée dans le navigateur. |
| **Bilingue** | Français et anglais, bouton FR / EN dans la barre de navigation. |

---

## Le modèle Elo

Détails complets, définition des 42 variables et précision mesurée : [docs/MODELE_ELO.md](docs/MODELE_ELO.md).

- Fichier d'origine : `modele_elo.joblib` (LightGBM, 600 arbres), entraîné sur des profils de 20 à 50 parties (Elo 809 à 2 796).
- Entrée : un profil de joueur de 42 variables (pertes en centipions, précision, phases de jeu, positions critiques, gestion du temps), calculé par `src/elo/features.ts`.
- Export exact pour le navigateur et l'API : `public/models/elo_lgbm.json` (`scripts/export_lgbm_model.py`, écart 0 avec LightGBM).
- Précision mesurée sur 103 joueurs Lichess réels, parties analysées par le moteur du site : erreur moyenne de 173 points avec 20 parties (68 % des prédictions à ±200 près), 364 avec une seule. Pour reproduire : `npm run eval:elo`.
- Ordre d'utilisation dans le site : modèle dans le navigateur, puis API Flask, puis estimation provisoire clairement signalée comme telle.

API :

```
POST /api/predict-elo   {"features": [42 valeurs, null si manquante]}   (ordre : GET /api/health)
GET  /api/health
```

---

## Déploiement

### Front : Vercel

1. Importer le dépôt sur vercel.com (framework détecté : Vite). `vercel.json` gère les routes de l'application et le cache du moteur.
2. Variable d'environnement : `VITE_API_URL` = URL de l'API Render (facultatif : sans elle, le modèle tourne dans le navigateur).
3. Facultatif : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` pour les comptes et le jeu en ligne.

### API : Render (gratuit)

1. Sur render.com : New, Blueprint, choisir ce dépôt. `render.yaml` crée le service `chesshub-elo-api`.
2. Le service charge l'export JSON du modèle (`ml_backend/elo_lgbm.json`, 1,3 Mo), sans dépendance lourde.
3. Le plan gratuit se met en veille : le premier appel peut prendre ~50 s. Le site n'attend pas (délai de 6 s) et prédit dans le navigateur.

---

## Données des puzzles

`public/puzzles/` est généré depuis la base ouverte Lichess (licence CC0) :

```bash
zstd -dc lichess_db_puzzle.csv.zst | python scripts/build_puzzles.py - public/puzzles
```

Le script garde des puzzles bien notés et souvent joués : 7 500 puzzles, 300 par tranche de 100 points d'Elo de 400 à 2 800, un petit fichier JSON par tranche. Toutes les solutions ont été rejouées et vérifiées avec chess.js.

---

## Stack

React 18, TypeScript, Vite 5, Tailwind 3, react-router 6, chess.js, Stockfish 19 lite (WASM), lucide-react, Flask. Supabase en option (`supabase-setup.sql`).

## Licences et crédits

- Stockfish : GPL v3 (https://stockfishchess.org), build WASM de `stockfish` (npm).
- Pièces : jeu "cburnett" (CC BY-SA 3.0), via Lichess.
- Puzzles : base de puzzles Lichess (CC0).
