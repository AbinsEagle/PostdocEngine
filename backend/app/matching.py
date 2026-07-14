"""Lightweight match/recommendation engine.

Scores postdoc positions against a researcher's profile using keyword and
field overlap plus a small freshness/deadline signal. No external ML
dependencies — it's a transparent, explainable heuristic that's easy to
tune and fast enough to run on every request.
"""

from __future__ import annotations

import re
from datetime import date

from .models import Position, Researcher

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> set[str]:
    """Split arbitrary text into a set of lowercased alphanumeric tokens."""
    if not text:
        return set()
    return {t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 1}


def _keyword_set(raw: str) -> set[str]:
    """Parse a comma-separated keyword string into normalized phrases."""
    return {k.strip().lower() for k in raw.split(",") if k.strip()}


def score_position(researcher: Researcher, position: Position) -> tuple[float, list[str], str]:
    """Return ``(score, matched_keywords, reason)`` for one position.

    The score is in ``[0, 1]``. It combines:
      * keyword overlap between the researcher's interests and the
        position's keywords/description (primary signal),
      * a field match bonus,
      * a small recency/deadline-open bonus.
    """
    researcher_keywords = _keyword_set(researcher.keywords)
    researcher_tokens = _tokenize(researcher.keywords) | _tokenize(researcher.field)

    position_keywords = _keyword_set(position.keywords)
    position_tokens = (
        _tokenize(position.keywords)
        | _tokenize(position.title)
        | _tokenize(position.description)
        | _tokenize(position.field)
    )

    # Exact keyword-phrase matches carry the most weight and are surfaced
    # to the user as the human-readable "why".
    matched_phrases = sorted(researcher_keywords & position_keywords)

    # Token overlap is a softer signal (e.g. "machine" from "machine learning"
    # matching a description mentioning machine learning).
    token_overlap = researcher_tokens & position_tokens
    denom = len(researcher_tokens) or 1
    token_score = len(token_overlap) / denom

    phrase_score = 0.0
    if researcher_keywords:
        phrase_score = len(matched_phrases) / len(researcher_keywords)

    field_bonus = 0.0
    if researcher.field and position.field:
        if _tokenize(researcher.field) & _tokenize(position.field):
            field_bonus = 0.15

    # Reward positions whose deadline is still open.
    freshness_bonus = 0.0
    if position.deadline and position.deadline >= date.today():
        freshness_bonus = 0.05

    raw = 0.6 * phrase_score + 0.2 * token_score + field_bonus + freshness_bonus
    score = round(min(raw, 1.0), 3)

    if matched_phrases:
        reason = "Matches your interests: " + ", ".join(matched_phrases)
    elif token_overlap:
        reason = "Related to your profile: " + ", ".join(sorted(token_overlap)[:5])
    elif field_bonus:
        reason = f"Same field: {position.field}"
    else:
        reason = "General postdoc opportunity"

    return score, matched_phrases or sorted(token_overlap)[:5], reason


def recommend(researcher: Researcher, positions: list[Position], limit: int = 10):
    """Rank positions for a researcher, best first, dropping zero-score ones."""
    scored = []
    for position in positions:
        score, matched, reason = score_position(researcher, position)
        if score > 0:
            scored.append((score, matched, reason, position))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:limit]
