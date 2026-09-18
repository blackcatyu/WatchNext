import re
from pathlib import Path

import pandas as pd
import torch
from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import pipeline

IN_PATH = Path("data/processed/reviews_final.csv")
OUT_DIR = Path("data/processed")

MODEL_NAME = "siebert/sentiment-roberta-large-english"
BATCH_SIZE = 16
TOP_KEYWORDS_PER_MOVIE = 8

HTML_TAG_RE = re.compile(r"<[^>]+>")
URL_RE = re.compile(r"https?://\S+")
WHITESPACE_RE = re.compile(r"\s+")


def clean_text(text: str) -> str:
    text = HTML_TAG_RE.sub(" ", text)
    text = URL_RE.sub(" ", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def load_reviews() -> pd.DataFrame:
    df = pd.read_csv(IN_PATH)
    df["content"] = df["content"].astype(str).map(clean_text)
    df = df[df["content"].str.len() >= 20]
    before = len(df)
    df = df.drop_duplicates(subset=["content"], keep="first")
    print(f"reviews: {before} -> {len(df)} after cleaning/dedup")
    return df.reset_index(drop=True)


def score_sentiment(texts: list[str]) -> pd.DataFrame:
    device = 0 if torch.cuda.is_available() else -1
    print(f"scoring sentiment on {'GPU' if device == 0 else 'CPU'} ({len(texts):,} reviews)")
    clf = pipeline(
        "sentiment-analysis",
        model=MODEL_NAME,
        truncation=True,
        max_length=512,
        device=device,
    )
    results = clf(texts, batch_size=BATCH_SIZE)
    return pd.DataFrame(results).rename(columns={"label": "sentiment_label", "score": "sentiment_score"})


def extract_keywords(df: pd.DataFrame) -> pd.DataFrame:
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=5000, min_df=3)
    tfidf = vectorizer.fit_transform(df["content"])
    terms = vectorizer.get_feature_names_out()

    rows = []
    for tmdb_id, group in df.groupby("tmdbId"):
        idx = group.index
        scores = tfidf[idx].sum(axis=0).A1
        top_idx = scores.argsort()[::-1][:TOP_KEYWORDS_PER_MOVIE]
        keywords = [terms[i] for i in top_idx if scores[i] > 0]
        rows.append({"tmdbId": tmdb_id, "keywords": keywords})
    return pd.DataFrame(rows)


def main() -> None:
    df = load_reviews()

    sentiment = score_sentiment(df["content"].tolist())
    df = pd.concat([df.reset_index(drop=True), sentiment], axis=1)
    df.to_csv(OUT_DIR / "reviews_sentiment.csv", index=False)

    keywords = extract_keywords(df)
    keywords.to_json(OUT_DIR / "review_keywords.jsonl", orient="records", lines=True)

    summary = (
        df.assign(is_positive=df["sentiment_label"].eq("POSITIVE"))
        .groupby("tmdbId")
        .agg(review_count=("content", "size"), pct_positive=("is_positive", "mean"),
             avg_sentiment_score=("sentiment_score", "mean"))
        .reset_index()
    )
    summary.to_csv(OUT_DIR / "review_sentiment_summary.csv", index=False)

    print(f"\nsentiment label counts:\n{df['sentiment_label'].value_counts()}")
    print(f"\nmovies with review data: {summary['tmdbId'].nunique()}")
    print(f"movies with keywords: {keywords['tmdbId'].nunique()}")


if __name__ == "__main__":
    main()
