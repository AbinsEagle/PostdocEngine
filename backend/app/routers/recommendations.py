from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import matching, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("/{researcher_id}", response_model=list[schemas.Recommendation])
def recommendations_for_researcher(
    researcher_id: int,
    limit: int = Query(10, ge=1, le=50),
    exclude_applied: bool = Query(True, description="Hide positions already applied to"),
    db: Session = Depends(get_db),
):
    """Rank open positions for a researcher using the match engine."""
    researcher = db.get(models.Researcher, researcher_id)
    if not researcher:
        raise HTTPException(404, "Researcher not found")

    positions = db.query(models.Position).all()

    if exclude_applied:
        applied_ids = {
            app.position_id
            for app in db.query(models.Application)
            .filter(models.Application.researcher_id == researcher_id)
            .all()
        }
        positions = [p for p in positions if p.id not in applied_ids]

    ranked = matching.recommend(researcher, positions, limit=limit)
    return [
        schemas.Recommendation(
            position=schemas.Position.model_validate(position),
            score=score,
            matched_keywords=matched,
            reason=reason,
        )
        for score, matched, reason, position in ranked
    ]
