from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

OUT_DIR = Path("data/figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main() -> None:
    df = pd.read_json("data/processed/movies_final.jsonl", lines=True)
    df = df.dropna(subset=["year"]).copy()
    df["decade"] = (df["year"] // 10 * 10).astype(int)

    pivot = df.pivot_table(index="decade", columns="source", aggfunc="size", fill_value=0)
    for col in ["historical", "recent"]:
        if col not in pivot.columns:
            pivot[col] = 0
    pivot = pivot[["historical", "recent"]].sort_index()

    fig, ax = plt.subplots(figsize=(9, 4.5))
    labels = [f"{d}s" for d in pivot.index]
    ax.bar(labels, pivot["historical"], label="historical (MovieLens-linked)", color="#3b6ea5")
    ax.bar(labels, pivot["recent"], bottom=pivot["historical"], label="recent (TMDB-only)", color="#e07b39")
    ax.set_title(f"Candidate set: release decade of {len(df):,} movies")
    ax.set_ylabel("movie count")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUT_DIR / "historical_year_distribution.svg")
    print(f"saved to {OUT_DIR / 'historical_year_distribution.svg'}")


if __name__ == "__main__":
    main()
