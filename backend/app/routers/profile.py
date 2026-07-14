from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/researchers", tags=["researchers"])


@router.get("", response_model=list[schemas.Researcher])
def list_researchers(db: Session = Depends(get_db)):
    return db.query(models.Researcher).order_by(models.Researcher.id).all()


@router.post("", response_model=schemas.Researcher, status_code=201)
def create_researcher(payload: schemas.ResearcherCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.Researcher)
        .filter(models.Researcher.email == payload.email)
        .first()
    )
    if existing:
        raise HTTPException(400, "A researcher with that email already exists")
    researcher = models.Researcher(**payload.model_dump())
    db.add(researcher)
    db.commit()
    db.refresh(researcher)
    return researcher


@router.get("/{researcher_id}", response_model=schemas.Researcher)
def get_researcher(researcher_id: int, db: Session = Depends(get_db)):
    researcher = db.get(models.Researcher, researcher_id)
    if not researcher:
        raise HTTPException(404, "Researcher not found")
    return researcher


@router.put("/{researcher_id}", response_model=schemas.Researcher)
def update_researcher(
    researcher_id: int,
    payload: schemas.ResearcherUpdate,
    db: Session = Depends(get_db),
):
    researcher = db.get(models.Researcher, researcher_id)
    if not researcher:
        raise HTTPException(404, "Researcher not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(researcher, key, value)
    db.commit()
    db.refresh(researcher)
    return researcher


@router.delete("/{researcher_id}", status_code=204)
def delete_researcher(researcher_id: int, db: Session = Depends(get_db)):
    researcher = db.get(models.Researcher, researcher_id)
    if not researcher:
        raise HTTPException(404, "Researcher not found")
    db.delete(researcher)
    db.commit()
