# Chess Game - Projet Innovation

Une application d'échecs moderne et complète avec entraînement par IA, analyse de parties et prédiction Elo.

## Fonctionnalités

### Jeu Solo (vs IA)
- ✅ **Règles d'échecs complètes** : Roque, en passant, promotion de pion
- ✅ **Validation des coups** : Validation en temps réel avec chess.js
- ✅ **Détection d'échec et mat** : Détection automatique des conditions de fin de partie
- ✅ **IA Stockfish** : Jouez contre un moteur d'échecs puissant
- ✅ **Historique des coups** : Suivi de tous les coups en notation algébrique
- ✅ **Design responsive** : Interface moderne adaptée à tous les écrans
- ✅ **Animations fluides** : Mouvements de pièces et feedback visuel

### Multijoueur
- ✅ **Authentification** : Inscription et connexion par email
- ✅ **Système Elo** : Calcul dynamique du classement
- ✅ **Classement** : Classement en temps réel des meilleurs joueurs
- ✅ **Matchmaking** : Trouvez des adversaires de niveau similaire
- ✅ **Multijoueur en temps réel** : Jouez avec synchronisation en direct
- ✅ **Chat en jeu** : Communiquez avec votre adversaire
- ✅ **Profils utilisateurs** : Suivez vos statistiques et historique

### AI Coach (Nouveau)
- ✅ **Game Rewinder** : Analysez vos parties en rembobinant les coups
  - Animation automatique avec délai de 800ms
  - Raccourcis clavier (flèches, espace, escape)
  - Analyse de la qualité des coups (best, good, inaccuracy, mistake, blunder)
- ✅ **Tactic Trainer** : Entraînement tactique interactif
  - 6 puzzles niveau débutant (Fork, Pin, Discovered Attack, Skewer, Back Rank, Mate in 1)
  - Système de progression (puzzles résolus, série de victoires)
  - Effets sonores et feedback visuel
- ✅ **Position Trainer** : Maîtrisez les positions critiques
  - 6 positions niveau débutant (Italian Game, Pin, Center Control, Development)
  - Explications détaillées des meilleurs coups
  - Statistiques de progression
- ✅ **Elo Prediction** : Prédiction Elo avec ML
  - Backend Python Flask avec API REST
  - Méthode de fallback si le modèle ML n'est pas disponible
  - Analyse basée sur les caractéristiques des parties

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Chess Logic**: chess.js (v1.0.0-beta.8)
- **AI Engine**: Stockfish WebAssembly
- **Backend**: Supabase (Authentication, Database, Real-time)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (ready)

## Installation

### Prerequisites

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and create a free account
   - Create a new project
   - Wait for the project to be ready (2-3 minutes)

2. **Set up the Database**:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and run the SQL script from `supabase-setup.sql`
   - This will create all necessary tables and set up Row Level Security

3. **Get your Supabase Credentials**:
   - Go to Project Settings → API
   - Copy your Project URL and anon/public key

4. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Install Dependencies**:
```bash
npm install
```

6. **Start the Development Server**:
```bash
npm run dev
```

7. **Open your browser** to `http://localhost:3000`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## How to Play

### Single Player (vs AI)
1. Click on "vs AI" in the header
2. **Click on a piece** to select it and see possible moves highlighted
3. **Click on a highlighted square** to move the piece
4. **Use the controls** on the right to:
   - Start a new game
   - Undo the last move
   - Adjust AI difficulty (Beginner to Expert)
5. **Watch the move history** panel to track the game progress

### Multiplayer
1. Click on "Multiplayer" in the header
2. **Sign in or create an account** if you haven't already
3. Click "Find Match" to search for an opponent
4. Wait for matchmaking to find a suitable opponent
5. Play the game with real-time synchronization
6. Use the chat to communicate with your opponent

## Difficulty Levels

- **Beginner**: AI makes random moves occasionally
- **Easy**: Basic positional understanding
- **Medium**: Decent tactical play (default)
- **Hard**: Strong tactical and positional play
- **Expert**: Maximum strength with deep analysis

## Elo Rating System

The game uses the standard Elo rating algorithm:
- Starting rating: 1200
- K-factor: 32 (standard for most players)
- Ratings update automatically after each completed game
- Both players' ratings are adjusted based on the result

## Game Rules Implemented

- Standard piece movements (King, Queen, Rook, Bishop, Knight, Pawn)
- Castling (both kingside and queenside)
- En passant captures
- Pawn promotion (auto-promotes to Queen)
- Check detection with visual indicator
- Checkmate detection
- Stalemate detection
- Draw by repetition and insufficient material

## Database Schema

The application uses the following Supabase tables:

- **profiles**: User profiles with ratings and statistics
- **games**: Game records with FEN, PGN, and status
- **matchmaking_queue**: Real-time matchmaking queue
- **messages**: In-game chat messages

## Project Structure

```
chess-game/
├── src/
│   ├── components/      # React components
│   │   ├── ChessBoard.tsx
│   │   ├── Square.tsx
│   │   ├── Piece.tsx
│   │   ├── MoveHistory.tsx
│   │   ├── GameControls.tsx
│   │   ├── AuthModal.tsx
│   │   ├── UserProfile.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── MatchmakingPanel.tsx
│   │   └── Chat.tsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useChessGame.ts
│   │   ├── useStockfish.ts
│   │   ├── useAuth.ts
│   │   ├── useMatchmaking.ts
│   │   └── useMultiplayerGame.ts
│   ├── lib/            # Utility libraries
│   │   ├── supabase.ts
│   │   └── elo.ts
│   ├── utils/          # Utility functions
│   │   ├── pieceUnicode.ts
│   │   └── boardUtils.ts
│   ├── types/          # TypeScript types
│   │   ├── chess.ts
│   │   └── auth.ts
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   ├── index.css       # Global styles
│   └── vite-env.d.ts   # Vite environment types
├── public/             # Static assets
├── supabase-setup.sql  # Database setup script
├── .env.example        # Environment variables template
├── index.html          # HTML template
├── package.json        # Dependencies
├── tailwind.config.js  # Tailwind configuration
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite configuration
```

## Déploiement sur Vercel

### Étape 1 : Push sur GitHub

```bash
# Initialiser git si ce n'est pas déjà fait
git init

# Ajouter tous les fichiers
git add .

# Commit
git commit -m "Initial commit - Chess Game with AI Coach"

# Ajouter le repository distant
git remote add origin https://github.com/gitabdelhub/site_projet_innov.git

# Push sur GitHub
git branch -M main
git push -u origin main
```

### Étape 2 : Déploiement sur Vercel

1. **Créer un compte Vercel** : Allez sur [vercel.com](https://vercel.com) et créez un compte gratuit

2. **Importer le projet** :
   - Cliquez sur "Add New Project"
   - Sélectionnez votre repository GitHub `gitabdelhub/site_projet_innov`
   - Vercel détectera automatiquement que c'est un projet Vite

3. **Configurer les variables d'environnement** :
   - Dans les paramètres du projet Vercel, allez dans "Settings" → "Environment Variables"
   - Ajoutez les variables suivantes :
     ```
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Déployer** :
   - Cliquez sur "Deploy"
   - Attendez que le déploiement se termine (environ 2-3 minutes)
   - Vercel vous donnera une URL comme `https://site-projet-innov.vercel.app`

### Étape 3 : Partager avec vos collègues

Une fois déployé sur Vercel, vos collègues pourront accéder au site via l'URL fournie par Vercel. Vous pouvez aussi :

- **Personnaliser le domaine** : Dans Vercel, allez dans "Settings" → "Domains" pour ajouter un domaine personnalisé
- **Partager l'URL** : Envoyez simplement l'URL Vercel à vos collègues
- **Mettre à jour automatiquement** : Chaque push sur GitHub déclenchera automatiquement un nouveau déploiement

### Note sur le Backend ML

Le backend Python pour la prédiction Elo (`ml_backend/app.py`) n'est pas inclus dans le déploiement Vercel car Vercel ne supporte pas nativement Python. Pour utiliser la prédiction ML en production :

1. **Option 1 : Utiliser un service comme Render ou Railway**
   - Déployez le backend Python sur Render.com ou Railway.app
   - Mettez à jour l'URL dans `CoachElo.tsx` pour pointer vers le backend déployé

2. **Option 2 : Utiliser uniquement la méthode de fallback**
   - Le site fonctionne déjà avec la méthode de fallback
   - Les collègues pourront utiliser le site sans le backend ML

### Pour vos collègues

Vos collègues pourront :
- Jouer aux échecs solo vs IA
- Jouer en multijoueur (si Supabase est configuré)
- Utiliser le Game Rewinder pour analyser leurs parties
- S'entraîner avec le Tactic Trainer et Position Trainer
- Voir la prédiction Elo (avec la méthode de fallback)

Ils n'ont besoin que de l'URL Vercel pour accéder au site !

## License

MIT License - feel free to use this project for learning or as a base for your own chess application.
