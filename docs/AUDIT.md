# Audit du site (phase 1), 4 novembre 2026

Méthode : `npm install`, `tsc --noEmit` (OK, aucune erreur de type), `vite` lancé en local, chaque page ouverte en desktop (1366 px) et mobile (390 px) avec Playwright, une partie jouée contre Stockfish à la souris, puis lecture du code de chaque fonctionnalité cœur.

## 1. Jeu contre Stockfish (`useChessGame`, `useStockfish`, `pages/Game.tsx`)

| # | Bug | Gravité |
|---|-----|---------|
| 1.1 | Le moteur ne joue plus quand les Noirs sont en échec : l'effet ne se déclenche que si `status === 'playing'`, or un échec donne `status === 'check'`. La partie se bloque. | Bloquant |
| 1.2 | "Undo" n'annule qu'un demi-coup : on annule le coup du moteur, le moteur rejoue aussitôt le même coup. | Majeur |
| 1.3 | Promotion toujours en Dame (le `PromotionModal` existe mais n'est pas branché sur le mode IA). | Majeur |
| 1.4 | Race condition : `getBestMove` stocke une seule promesse ; "New Game" pendant que le moteur réfléchit laisse arriver un `bestmove` de l'ancienne position. | Majeur |
| 1.5 | `React.StrictMode` crée deux Workers Stockfish en dev (double chargement de 1,5 Mo). | Mineur |
| 1.6 | Niveau incohérent : le menu dit "Level 3 (Elo ~1600)", l'écran de jeu affiche "~2000". Les niveaux ne sont pas calibrés. | Moyen |
| 1.7 | Barre d'évaluation figée à 0.0 : aucune évaluation n'est demandée au moteur. | Moyen |
| 1.8 | Pas de choix de couleur, pas d'abandon, pas de fin de partie claire avec suite logique (prédiction Elo, coach). | Majeur pour la démo |
| 1.9 | La pendule de l'humain décompte pendant que le moteur réfléchit, sans incrément, et la pendule du moteur tourne aussi : sans intérêt pour l'entraînement. | Mineur |
| 1.10 | Pièces SVG maison mal dessinées : le Roi ressemble à un pion, le Cavalier est une forme indistincte, Fou et Roi se confondent. Erreur console `<path> attribute d: Expected path command` à chaque affichage. | Majeur (visuel) |
| 1.11 | Pas de drag and drop, uniquement clic-clic. | Moyen |

## 2. Game Rewinder (`components/GameRewinder.tsx`)

| # | Bug | Gravité |
|---|-----|---------|
| 2.1 | L'"analyse" est **aléatoire** (`Math.random()`), elle change à chaque rendu. Aucun calcul Stockfish. Indéfendable devant un jury. | Bloquant |
| 2.2 | L'autoplay crée un `setInterval` jamais nettoyé (le `return` du handler ne sert à rien) : plusieurs clics = plusieurs intervalles, positions qui sautent. | Majeur |
| 2.3 | L'autoplay sort du mode rewind à la fin, l'utilisateur perd sa position. | Mineur |

## 3. Prédiction Elo (`pages/CoachElo.tsx`, `ml_backend/app.py`)

| # | Bug | Gravité |
|---|-----|---------|
| 3.1 | Les 11 features envoyées (nb de coups, prises, échecs, coups par pièce) sont inventées côté front, sans lien avec le notebook. Le modèle réel attendra sûrement d'autres features. | Bloquant (à refaire avec le notebook) |
| 3.2 | URL codée en dur `http://localhost:5000` : ne marchera jamais en ligne. | Bloquant |
| 3.3 | Précision, vision tactique, ouverture, finale, style : **valeurs aléatoires**. | Bloquant |
| 3.4 | Si le backend est absent, l'écran affiche une erreur au lieu d'un repli local. | Majeur |
| 3.5 | Résultat de la partie recalculé faux (`1/2-1/2` si pas de mat, même en cas d'abandon) au lieu de lire l'en-tête PGN. | Moyen |
| 3.6 | Côté Flask : pas de validation du nombre de features, `debug=True`, pas de `gunicorn` pour Render. | Moyen |

## 4. Trainers (`CoachTactics`, `CoachPosition`, `CoachThemes`)

| # | Bug | Gravité |
|---|-----|---------|
| 4.1 | 6 "puzzles" codés en dur, dont la plupart sont des coups d'ouverture et non des tactiques ; un seul coup attendu, réponse comparée en SAN brute. | Bloquant |
| 4.2 | Puzzle 4 : la "solution" Nxe5 n'est pas légale dans la position donnée, puzzle 5 idem (le texte dit "développer le Fou" pour Bxf7+). | Majeur |
| 4.3 | Aucun lien avec l'Elo prédit : la boucle innovante n'existe pas. | Bloquant |
| 4.4 | Position Trainer et Theme Analyzer : écrans statiques, pas de progression réelle. | Majeur |

## 5. Design et contenu

| # | Bug | Gravité |
|---|-----|---------|
| 5.1 | Icônes en emoji partout (accueil, coach, jeu, classement). | Moyen |
| 5.2 | Mini-échiquier du hero délavé (pièces grises sur cases pâles, coins vides). | Moyen |
| 5.3 | Logo "Chess Hub" affiché deux fois sur mobile `/game` (header + panneau). Aussi présent sur desktop dans le panneau de droite. | Moyen |
| 5.4 | Encadré "Supabase Config Required" visible par l'utilisateur. | Majeur |
| 5.5 | Bloc "Your Progress" figé à 0 (rien n'est enregistré). | Majeur |
| 5.6 | Classement rempli de faux joueurs (GrandMaster, ChessPro...) en mode local : à cacher ou étiqueter "démo" sans Supabase. | Moyen |
| 5.7 | Interface uniquement en anglais, aucun système de traduction. | Majeur (exigence) |
| 5.8 | Texte du coach "link your Chess.com/Lichess accounts" : fonctionnalité inexistante. | Moyen |

## 6. Architecture et déploiement

| # | Point | Gravité |
|---|-------|---------|
| 6.1 | Supabase : client créé avec une URL bidon quand non configuré ; plusieurs hooks l'appellent quand même. À isoler derrière un module optionnel. | Majeur |
| 6.2 | Aucune config Vercel (`vercel.json` pour les routes SPA : un refresh sur `/game` donnera une 404). | Bloquant pour le déploiement |
| 6.3 | Pas de `Procfile` / `render.yaml`, pas de variable `VITE_API_URL`. | Bloquant pour le déploiement |
| 6.4 | `package-lock.json` ignoré par git : builds non reproductibles. | Moyen |
| 6.5 | 4 captures `inspi*.png` (1,8 Mo) et `resume_travail.tex` à la racine. | Mineur |
| 6.6 | Puzzles Lichess : la base `database.lichess.org` n'est pas joignable depuis mon environnement cloud. Solution à trouver (téléchargement depuis ton PC ou un miroir). | À décider |

## Plan de reconstruction proposé

- **Moteur** : un seul Worker Stockfish partagé, file de commandes avec identifiant de requête (fin des race conditions), niveaux calibrés par `Skill Level` + profondeur, évaluation en continu pour la barre.
- **Jeu** : état dérivé d'un seul historique de coups (source de vérité unique), undo par paire de coups, choix de couleur, promotion avec choix, abandon, fin de partie qui enchaîne sur "Analyser ma partie" puis "Exercices adaptés".
- **Rewinder** : analyse réelle Stockfish coup par coup (perte en centipions, catégories meilleur / bon / imprécision / erreur / gaffe), navigation clavier et boutons, graphe d'évaluation.
- **Elo** : features extraites **exactement** comme dans le notebook, prédiction par l'API Flask, repli local si l'API ne répond pas (voir décision ci-dessous).
- **Coach** : extrait Lichess embarqué (JSON par tranche d'Elo et par thème), puzzles multi-coups avec réponse du moteur, sélection autour de l'Elo prédit, progression stockée en `localStorage`.
- **Pièces** : jeu de pièces open source standard (cburnett, celui de Lichess, licence libre) à la place des SVG cassés.
