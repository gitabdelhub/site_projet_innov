# Elo model: measured results

Data: 3769 rated Lichess games (7538 player-games), ratings 421-3001, downloaded with `ml/collect-lichess.mjs` (games already analysed by Lichess's Stockfish, spread evenly from 600 to 3000).
Every number is measured on players the model never saw (5-fold cross-validation grouped by player).
Ratings are Lichess ratings of the game's time control (blitz, rapid or classical).

## One game

| Method | Mean error | Within ±200 | R² |
|---|---|---|---|
| Average rating (no information) | 604 | 17% | -0.02 |
| Old formula (ACPL only) | 501 | 24% | 0.17 |
| Linear model (ridge) | 399 | 30% | 0.49 |
| Gradient boosting (chosen) | 362 | 34% | 0.57 |

## Several games of the same player (chosen model, estimates averaged)

| Games | Mean error | 80% of estimates within | Within ±200 |
|---|---|---|---|
| 1 | 373 | ±596 | 35% |
| 3 | 316 | ±499 | 36% |
| 5 | 300 | ±470 | 37% |
| 10 | 284 | ±454 | 40% |

## Error by level (one game)

| Rating | Player-games | Mean error |
|---|---|---|
| 600-999 | 1253 | 411 |
| 1000-1399 | 1254 | 334 |
| 1400-1799 | 1241 | 347 |
| 1800-2199 | 1257 | 339 |
| 2200-2599 | 1246 | 286 |
| 2600-2999 | 1245 | 448 |

## In the website's real conditions

200 games of 40 players left out of training, analysed twice:
with Lichess's evaluations, and with the website's own engine (Stockfish 18 lite, depth 12).

| Evaluations from | Mean error (one game) | Within ±200 |
|---|---|---|
| Lichess analysis | 366 | 33% |
| Website engine | 374 | 34% |

Average gap between the two estimates for the same game: 231 points.

## What the model looks at most

| Feature | Importance |
|---|---|
| my_opening_loss | 59.3% |
| opp_balanced_acpl | 8.0% |
| my_acpl | 7.5% |
| opp_acpl | 6.5% |
| opp_best_rate | 4.1% |
| my_moves | 3.6% |
| my_balanced_acpl | 3.6% |
| my_accuracy | 2.1% |
| my_best_rate | 1.6% |
| opp_accuracy | 1.3% |
| my_balanced_blunder_rate | 0.7% |
| my_inaccuracy_rate | 0.5% |
| my_mistake_rate | 0.3% |
| my_loss_p75 | 0.3% |
| my_blunder_rate | 0.2% |
| opp_blunder_rate | 0.2% |
| my_score | 0.1% |
