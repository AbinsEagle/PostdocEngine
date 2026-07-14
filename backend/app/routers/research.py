from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/research", tags=["research"])


@router.get("", response_model=list[schemas.ResearchItem])
def list_research_items(
    researcher_id: int | None = Query(None),
    type: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.ResearchItem)
    if researcher_id is not None:
        query = query.filter(models.ResearchItem.researcher_id == researcher_id)
    if type:
        query = query.filter(models.ResearchItem.type == type)
    if status:
        query = query.filter(models.ResearchItem.status == status)
    return query.order_by(models.ResearchItem.updated_at.desc()).all()


@router.post("", response_model=schemas.ResearchItem, status_code=201)
def create_research_item(
    payload: schemas.ResearchItemCreate, db: Session = Depends(get_db)
):
    if not db.get(models.Researcher, payload.researcher_id):
        raise HTTPException(404, "Researcher not found")
    item = models.ResearchItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=schemas.ResearchItem)
def get_research_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.ResearchItem, item_id)
    if not item:
        raise HTTPException(404, "Research item not found")
    return item


@router.put("/{item_id}", response_model=schemas.ResearchItem)
def update_research_item(
    item_id: int, payload: schemas.ResearchItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(models.ResearchItem, item_id)
    if not item:
        raise HTTPException(404, "Research item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_research_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.ResearchItem, item_id)
    if not item:
        raise HTTPException(404, "Research item not found")
    db.delete(item)
    db.commit()
