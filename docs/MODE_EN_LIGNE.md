# Le mode en ligne

Parties en temps réel entre joueurs, avec comptes, classement Elo, défis par lien, revanche et discussion. Le reste du site (jeu contre Stockfish, analyse, modèle Elo, puzzles, progression) n'en dépend pas : sans Supabase, ou si le projet Supabase ne répond plus, les pages en ligne affichent « Le mode en ligne est momentanément indisponible » et tout le reste fonctionne.

## Ce que fait le mode en ligne

| Fonction | Détail |
|---|---|
| Comptes | Pseudo, email, mot de passe (Supabase Auth). L'email reste privé : il n'est pas dans la table publique des profils. |
| Partie rapide | 10 cadences, de 1+0 (bullet) à 30+0 (classique). Le serveur apparie les joueurs de la même cadence, au classement le plus proche. |
| Défier un ami | Choix de la cadence, de la couleur et partie classée ou amicale. Le site donne un lien à envoyer ; l'ami l'ouvre et accepte. |
| Pendules | Tenues par le serveur. Chaque coup est horodaté par la base de données, l'incrément est ajouté côté serveur. Un coup envoyé après la chute du drapeau est refusé et la partie est perdue au temps. |
| Premier coup | 30 secondes pour jouer son premier coup, sinon la partie est annulée (comme sur Lichess). La pendule ne démarre qu'après le premier coup de chaque camp. |
| Fin de partie | Mat, pat, matériel insuffisant, triple répétition, 50 coups, abandon, nulle par accord, temps. Au temps, si le gagnant ne peut pas mater (roi seul, ou roi et une pièce mineure), la partie est nulle. |
| Classement | Elo, départ à 1 500, K = 40 pour les 30 premières parties puis 20. Les variations s'affichent en fin de partie. |
| Revanche | Proposée par un joueur, acceptée par l'autre : nouvelle partie, couleurs inversées. |
| Discussion | Réservée aux deux joueurs. Les spectateurs peuvent regarder la partie, sans la discussion. |
| Présence | Point vert ou gris à côté du nom : l'adversaire a-t-il la page ouverte ? |
| Analyse | En fin de partie, « Analyser la partie » ouvre la même revue que contre Stockfish, avec l'Elo prédit par notre modèle (le temps passé sur chaque coup est enregistré, le modèle l'utilise). |
| Reprise | Recharger la page ou revenir plus tard reprend la partie en cours. |

## Sécurité : le serveur arbitre

Le site ne modifie jamais les tables directement (les droits d'écriture sont retirés). Toutes les actions passent par des fonctions SQL de `supabase-setup.sql` qui vérifient :

- que c'est bien le tour de celui qui joue, et que le coup part de la position actuelle (numéro de demi-coup) ;
- le temps restant, avec l'heure du serveur ;
- qu'un spectateur ne peut ni jouer, ni abandonner, ni accepter une nulle ;
- que l'appariement ne met jamais un joueur dans deux parties (verrous de ligne).

Limite connue : la légalité d'un coup est vérifiée par le navigateur de chaque joueur (chess.js), pas par la base, qui ne contient pas de moteur d'échecs. Le résultat d'un mat est accepté tel que l'annonce le joueur qui mate. Pour un site commercial, l'étape suivante serait une fonction serveur (Supabase Edge Function) qui rejoue chaque coup avec chess.js.

## Mise en route (une fois)

1. Créer un projet gratuit sur https://supabase.com (bouton **New project**, région Europe).
2. **SQL Editor** > **New query** : coller tout le fichier `supabase-setup.sql`, puis **Run**. Le script peut être relancé sans risque.
3. **Authentication** > **Sign In / Providers** : en haut de la page, section **User Signups**, désactiver **Confirm email** puis **Save changes**, pour que les comptes soient utilisables tout de suite (le réglage n'est pas dans le panneau « Email » plus bas). Dans **Authentication** > **URL Configuration**, mettre l'adresse du site (par exemple `https://site-projet-inno.vercel.app`) dans **Site URL**.
4. **Project Settings** > **API** (ou **Data API**) : copier **Project URL** et la clé **anon public**.
5. Vercel > le projet > **Settings** > **Environment Variables** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec ces deux valeurs, pour Production et Preview. Puis **Deployments** > **Redeploy**.

Attention : un projet Supabase gratuit est mis en pause après une semaine sans activité. Il suffit alors de cliquer **Restore** dans le tableau de bord Supabase. C'est ce qui était arrivé à l'ancien projet du site.

## Tests

| Commande | Ce qui est testé |
|---|---|
| `supabase/tests/run.sh` | 67 vérifications des fonctions SQL sur un Postgres local (tour, pendule, mat des deux côtés, pat, aucun coup après la fin, nulle, revanche, Elo, droits, discussion) |
| `supabase/tests/race.sh` | 12 joueurs qui cherchent une partie en même temps : chacun obtient exactement une partie |
| `supabase/tests/e2e-online.mjs` | Deux vrais navigateurs (un PC, un téléphone) : inscription, appariement, coups, discussion, mat, Elo, revanche, nulle, défi par lien, abandon, spectateur, classement, profil, chute du drapeau |

Les deux premiers demandent un Postgres local (`PGHOST`, `PGPORT`). Le test de bout en bout tourne contre un vrai projet Supabase, ou contre `supabase/tests/mock-supabase.mjs`, une doublure qui exécute les vraies fonctions SQL sur le Postgres local (sans le temps réel : le site passe alors en rafraîchissement toutes les 2 secondes, ce qui teste aussi ce mode de secours).

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase-setup.sql` | Tables, droits, fonctions de jeu, temps réel |
| `src/online/api.ts` | Appels aux fonctions, cadences |
| `src/online/useOnlineGame.ts` | Une partie : temps réel, pendules, coups, présence, discussion |
| `src/online/auth.tsx` | Comptes |
| `src/pages/OnlineLobby.tsx` | Salon : partie rapide, défi, dernières parties |
| `src/pages/OnlineGame.tsx` | Écran de partie, défi reçu, fin de partie, analyse |
| `src/pages/Leaderboard.tsx`, `Profile.tsx`, `Login.tsx` | Classement, profil, connexion |
