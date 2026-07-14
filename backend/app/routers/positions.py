from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/positions", tags=["positions"])


@router.get("", response_model=list[schemas.Position])
def list_positions(
    q: str | None = Query(None, description="Free-text search across title/keywords/description"),
    field: str | None = None,
    location: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Position)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Position.title.ilike(like),
                models.Position.institution.ilike(like),
                models.Position.keywords.ilike(like),
                models.Position.description.ilike(like),
            )
        )
    if field:
        query = query.filter(models.Position.field.ilike(f"%{field}%"))
    if location:
        query = query.filter(models.Position.location.ilike(f"%{location}%"))
    return query.order_by(models.Position.created_at.desc()).all()


@router.post("", response_model=schemas.Position, status_code=201)
def create_position(payload: schemas.PositionCreate, db: Session = Depends(get_db)):
    position = models.Position(**payload.model_dump())
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.get("/{position_id}", response_model=schemas.Position)
def get_position(position_id: int, db: Session = Depends(get_db)):
    position = db.get(models.Position, position_id)
    if not position:
        raise HTTPException(404, "Position not found")
    return position


@router.put("/{position_id}", response_model=schemas.Position)
def update_position(
    position_id: int, payload: schemas.PositionUpdate, db: Session = Depends(get_db)
):
    position = db.get(models.Position, position_id)
    if not position:
        raise HTTPException(404, "Position not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(position, key, value)
    db.commit()
    db.refresh(position)
    return position


@router.delete("/{position_id}", status_code=204)
def delete_position(position_id: int, db: Session = Depends(get_db)):
    position = db.get(models.Position, position_id)
    if not position:
        raise HTTPException(404, "Position not found")
    db.delete(position)
    db.commit()
