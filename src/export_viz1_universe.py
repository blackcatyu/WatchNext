"""Export star positions for Visualization 1's "universe" view: every candidate movie.

Movies with MovieLens ratings (the "audience" set: all historical movies plus recent
ones MovieLens covers) are laid out with UMAP on audience distance (1 - Jaccard overlap
of their >=4/5 fan bases), so movies that share fans end up near each other. Unrated
movies (mostly released after MovieLens' 2023-10 snapshot) have no audience distance;
each is placed at the content-similarity-weighted average position of the audience
movies it most resembles (its "anchors" from export_viz1_explorer.py), plus a small
offset so they don't stack. The page draws them differently and says so.

Run after export_viz1_explorer.py (it reads that file's output for the unrated movies' anchors).
"""

import json
import warnings
from pathlib import Path

import numpy as np
import umap

from export_viz1_explorer import OUT_PATH as EXPLORER_PATH, audience_similarity

OUT_PATH = Path("docs/data/viz1_universe.json")

N_NEIGHBORS = 15
MIN_DIST = 0.15
RANDOM_STATE = 7
CANVAS = 1000  # positions are scaled into [0, CANVAS]
UNRATED_JITTER = 0.012  # as a fraction of CANVAS


def main() -> None:
    explorer = json.loads(EXPLORER_PATH.read_text(encoding="utf-8"))
    movie_ids = [m["id"] for m in explorer["movies"]]

    jaccard = audience_similarity(movie_ids)[2]
    distance = 1 - jaccard
    np.fill_diagonal(distance, 0)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # UMAP warns that precomputed metrics disable its spectral init shortcuts
        xy = umap.UMAP(
            n_neighbors=N_NEIGHBORS, min_dist=MIN_DIST, metric="precomputed", random_state=RANDOM_STATE
        ).fit_transform(distance)

    lo, hi = xy.min(0), xy.max(0)
    xy = (xy - lo) / (hi - lo).max() * CANVAS
    xy += (CANVAS - xy.max(0)) / 2  # center the shorter axis

    pos = {mid: xy[i] for i, mid in enumerate(movie_ids)}
    rng = np.random.default_rng(RANDOM_STATE)
    unrated_xy = []
    for m in explorer["unrated"]:
        anchors = m["anchors"]
        if anchors:
            w = np.array([a["score"] for a in anchors])
            p = (np.array([pos[a["id"]] for a in anchors]) * w[:, None]).sum(0) / w.sum()
        else:
            p = np.array([CANVAS / 2, CANVAS / 2])
        unrated_xy.append(p + rng.normal(0, UNRATED_JITTER * CANVAS, 2))

    payload = {
        "size": CANVAS,
        "audience": [[mid, round(float(x), 1), round(float(y), 1)] for mid, (x, y) in pos.items()],
        "unrated": [
            [m["id"], round(float(x), 1), round(float(y), 1)] for m, (x, y) in zip(explorer["unrated"], unrated_xy)
        ],
    }
    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"stars: {len(payload['audience'])} with audience data + {len(payload['unrated'])} unrated")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e3:.0f} KB)")


if __name__ == "__main__":
    main()
