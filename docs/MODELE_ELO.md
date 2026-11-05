# Notre modèle de prédiction d'Elo

Ce document explique comment le site utilise notre modèle (`modele_elo.joblib`), ce que signifie chacune de ses 42 variables, et quelle précision nous avons mesurée sur de vraies parties.

## 1. Le modèle

| Élément | Valeur |
|---|---|
| Fichier d'origine | `modele_elo.joblib` (1,9 Mo) |
| Algorithme | LightGBM, 600 arbres de 31 feuilles, taux d'apprentissage 0,05 |
| Entrée | un **profil de joueur** de 42 variables, calculé sur plusieurs parties |
| Entraînement | 2 489 profils de 20 à 50 parties, Elo de 809 à 2 796 |
| Erreur annoncée à l'entraînement | 127 points d'Elo (validation croisée) |

Dans le site, le modèle tourne **dans le navigateur** : `scripts/export_lgbm_model.py` exporte les 600 arbres dans `public/models/elo_lgbm.json`, et `src/elo/model.ts` les parcourt. L'écart avec LightGBM est de 0 point. L'API Flask (`ml_backend/app.py`) fait le même calcul côté serveur.

### Point important : le modèle lit des valeurs brutes

Le `.joblib` contient aussi un `StandardScaler`. Il ne faut **pas** l'appliquer : les seuils des arbres sont en valeurs brutes (par exemple `n_games <= 37,5` ou `loss_first_third_avg <= 29,4`). Le scaler n'est prévu que pour une variante linéaire du modèle (`is_linear = False` ici). L'appliquer quand même donnait des prédictions bloquées autour de 1 550 pour tout le monde (erreur moyenne de 485 points). Nous gardons seulement sa moyenne, pour remplacer une valeur manquante par la moyenne d'entraînement.

## 2. Les 42 variables

Le notebook d'entraînement n'était pas disponible. Le `.joblib` donne les noms, l'ordre exact et la façon d'agréger (liste `robust` agrégée par médiane, liste `means` par moyenne). Nous avons reconstruit la définition de chaque statistique à partir de son nom, puis réglé les quelques paramètres libres sur de vraies parties (section 3). Le code de référence est `src/elo/features.ts`.

### Pour chaque partie

Pour chaque coup du joueur, on compare l'évaluation Stockfish avant et après le coup, du point de vue du joueur :

- **perte** (`loss`) = max(0, éval avant - éval après), en centipions. Les évaluations sont bornées à ±10 pions, un mat compte comme ±10 pions.
- **précision** (`acc`) = formule de précision par coup de Lichess, à partir de la baisse du pourcentage de gain.

Coups comptés : on ignore les **6 premiers coups** de chaque camp (théorie d'ouverture) et les coups joués dans une position **déjà décidée** (|éval| > 5 pions).

| Statistique | Définition |
|---|---|
| `loss_median`, `loss_q25`, `loss_q75`, `loss_q90` | médiane et quantiles 25, 75 et 90 % des pertes |
| `loss_trimmed_mean` | moyenne des pertes sans les 10 % les plus basses ni les 10 % les plus hautes |
| `loss_mean`, `loss_std` | moyenne et écart type des pertes |
| `acc_median`, `acc_mean` | médiane et moyenne des précisions |
| `loss_mean_open`, `_mid`, `_end` | perte moyenne en ouverture (jusqu'au coup 10), en finale (13 points de pièces ou moins sur l'échiquier, pions et rois exclus) et en milieu de jeu (le reste) |
| `loss_mean_critical`, `_noncritical` | perte moyenne quand la position est encore équilibrée (\|éval\| ≤ 1,5 pion), et sinon |
| `frac_critical` | part des coups joués en position équilibrée |
| `blunder_rate_critical` | part des gaffes (perte ≥ 2 pions) parmi les coups en position équilibrée |
| `loss_after_blunder` | perte moyenne sur le coup qui suit une gaffe |
| `frac_loss_0_10` ... `frac_loss_500_plus` | part des coups dont la perte est dans [0,10[, [10,25[, [25,50[, [50,100[, [100,200[, [200,500[, 500 et plus |
| `loss_first_third`, `loss_last_third` | perte moyenne sur le premier et le dernier tiers des coups comptés |
| `n_moves`, `n_plies` | nombre de coups comptés du joueur, nombre de demi coups de la partie |

Variables de temps (seulement si la partie a une pendule : parties jouées sur le site, ou PGN avec `[%clk]` et `TimeControl`) :

| Statistique | Définition |
|---|---|
| `time_median_frac` | temps médian par coup / temps initial |
| `time_std` | écart type du temps par coup, en secondes |
| `frac_fast_moves` | part des coups joués en moins de 5 % du temps initial |
| `loss_fast_moves`, `loss_slow_moves` | perte moyenne des coups rapides et des autres |
| `ratio_fast_slow` | perte des coups rapides / (perte des coups lents + 0,000001) |
| `corr_time_loss` | corrélation entre temps passé et perte |
| `frac_zeitnot`, `loss_zeitnot` | part et perte moyenne des coups joués avec moins de 10 % du temps initial à la pendule |
| `ratio_zeitnot` | perte en zeitnot / (perte hors zeitnot + 0,000001) |

Sans pendule, ces valeurs sont manquantes et remplacées par la moyenne d'entraînement. Elles pèsent environ 6 % des décisions du modèle.

### Pour le profil (plusieurs parties)

- variables `*_med` : médiane sur les parties ;
- variables `*_avg` : moyenne sur les parties ;
- `loss_median_between`, `acc_mean_between` : écart type entre les parties de `loss_median` et `acc_mean` ;
- `n_games` : nombre de parties (50 au plus), `frac_white` : part des parties jouées avec les Blancs.

## 3. Calage et précision mesurée

Données : 3 769 parties Lichess classées (`ml/data/lichess_calibration_games.ndjson`). 103 joueurs ont au moins 20 parties et un Elo dans la plage du modèle, soit 2 300 parties.

**Les évaluations viennent du moteur du site.** Un premier calage sur les évaluations de Lichess donnait de bons résultats sur le papier, mais notre Stockfish du navigateur (version lite, profondeur 12) ne mesure pas les pertes exactement comme Lichess : sur un même joueur à 1 500, la prédiction passait de 1 640 (évaluations Lichess) à 1 890 (notre moteur). Nous avons donc ré-analysé les 2 300 parties avec le moteur du site lui-même (`ml/data/calibration_evals_site_engine_d12.ndjson`, 27 minutes) et calé les paramètres sur ces évaluations, c'est-à-dire sur ce que le site calcule vraiment.

Les paramètres libres (nombre de coups d'ouverture ignorés, seuil de position décidée, seuil de position équilibrée, seuil de gaffe) ont été choisis parmi quelques valeurs simples (`npm run calibrate:elo`). Pour une mesure honnête, le script choisit aussi les paramètres sur une moitié des joueurs et mesure l'erreur sur l'autre moitié : **175 à 185 points**, proche de l'erreur sur tous les joueurs (172). Le choix ne colle donc pas artificiellement aux données.

Pour reproduire : `npm run eval:elo` (même code que le site).

| Parties dans le profil | Erreur moyenne | Prédictions à ±200 près |
|---|---|---|
| Toujours répondre la moyenne (référence) | 465 | |
| 1 | 364 | 34 % |
| 3 | 277 | 46 % |
| 5 | 245 | 50 % |
| 10 | 201 | 59 % |
| 20 | 173 | 68 % |

Limites honnêtes :

- l'erreur reste plus élevée que les 127 points annoncés à l'entraînement : nos définitions sont une reconstruction, et nos joueurs de test ont environ 22 parties (39 en moyenne à l'entraînement) ;
- comme tout modèle de ce type, il ramène vers le milieu : les débutants sont un peu surestimés, les très forts joueurs un peu sous-estimés ;
- la revue d'une partie seule utilise la profondeur 14 (meilleure classification des coups) alors que le calage est fait à la profondeur 12 ; l'écart mesuré est d'environ 50 points, bien inférieur à la marge affichée pour une seule partie ;
- les variables de temps n'ont pas pu être vérifiées (les parties de calage n'ont pas de pendule).

## 4. Dans le site

- **Après une partie contre Stockfish** : la partie rejoint le profil du joueur (ses parties précédentes sur ce navigateur, 50 au plus). L'Elo affiché vient du profil entier.
- **Analyse d'un PGN** : une seule partie donne une prédiction de fiabilité faible. Un fichier de plusieurs parties (export Lichess ou Chess.com) donne un vrai profil : le joueur est détecté, chaque partie est analysée par Stockfish (profondeur 12) et la prédiction s'affine à chaque partie.
- La marge affichée (± 360 pour 1 partie, ± 170 dès 20 parties) et l'étiquette de fiabilité (faible sous 5 parties, moyenne de 5 à 19, bonne dès 20) viennent du tableau ci-dessus.
