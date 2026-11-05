"""
Builds the puzzle extract embedded in the site (public/puzzles/) from the
open Lichess puzzle database (CC0): https://database.lichess.org/#puzzles

Usage:
    python scripts/build_puzzles.py lichess_db_puzzle.csv.zst public/puzzles
    zstd -dc lichess_db_puzzle.csv.zst | python scripts/build_puzzles.py - public/puzzles

The CSV columns are:
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags

We keep well rated, popular, often played puzzles, spread evenly by rating band
of 100 points (400 to 2800), and write one small JSON file per band so the
browser only downloads the bands it needs.
"""
import csv
import io
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

PER_BAND = 300
MIN_BAND, MAX_BAND = 400, 2800
random.seed(42)


def open_csv(path: str):
    if path == "-":
        # Already decompressed on stdin (no zstandard module needed).
        return io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
    if path.endswith(".zst"):
        import zstandard  # pip install zstandard

        fh = open(path, "rb")
        reader = zstandard.ZstdDecompressor().stream_reader(fh)
        return io.TextIOWrapper(reader, encoding="utf-8")
    return open(path, encoding="utf-8")


def main(src: str, out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    # Reservoir sampling per band keeps memory low on the 5 million rows file.
    bands: dict[int, list] = defaultdict(list)
    seen: dict[int, int] = defaultdict(int)
    with open_csv(src) as fh:
        for row in csv.DictReader(fh):
            try:
                rating = int(row["Rating"])
                if int(row["RatingDeviation"]) > 90 or int(row["Popularity"]) < 85 or int(row["NbPlays"]) < 300:
                    continue
            except (KeyError, ValueError):
                continue
            band = max(MIN_BAND, min(MAX_BAND, rating // 100 * 100))
            item = [row["PuzzleId"], row["FEN"], row["Moves"], rating, row["Themes"]]
            seen[band] += 1
            if len(bands[band]) < PER_BAND:
                bands[band].append(item)
            else:
                j = random.randrange(seen[band])
                if j < PER_BAND:
                    bands[band][j] = item

    index = []
    for band in sorted(bands):
        items = sorted(bands[band], key=lambda x: x[3])
        (out / f"{band}.json").write_text(json.dumps(items, separators=(",", ":")), encoding="utf-8")
        index.append({"band": band, "count": len(items)})
    (out / "index.json").write_text(
        json.dumps({"source": "Lichess puzzle database (CC0)", "fields": ["id", "fen", "moves", "rating", "themes"], "bands": index}, indent=1),
        encoding="utf-8",
    )
    print(f"{sum(b['count'] for b in index)} puzzles written in {len(index)} bands to {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
