from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

OUT_DIR = Path("data/figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main() -> None:
    df = pd.read_json("data/processed/movies_final.jsonl", lines=True)
    hist = df[df["source"] == "historical"].copy()
    hist["decade"] = (hist["year"] // 10 * 10).astype(int)
    counts = hist["decade"].value_counts().sort_index()

    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.bar([f"{d}s" for d in counts.index], counts.values, color="#3b6ea5")
    ax.set_title(f"Historical track: release decade of {len(hist):,} candidate movies")
    ax.set_ylabel("movie count")
    ax.bar_label(ax.containers[0])
    fig.tight_layout()
    fig.savefig(OUT_DIR / "historical_year_distribution.svg")
    print(f"saved to {OUT_DIR / 'historical_year_distribution.svg'}")


if __name__ == "__main__":
    main()
