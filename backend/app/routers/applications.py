from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("", response_model=list[schemas.Application])
def list_applications(
    researcher_id: int | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Application).options(
        joinedload(models.Application.position)
    )
    if researcher_id is not None:
        query = query.filter(models.Application.researcher_id == researcher_id)
    if status:
        query = query.filter(models.Application.status == status)
    return query.order_by(models.Application.updated_at.desc()).all()


@router.post("", response_model=schemas.Application, status_code=201)
def create_application(
    payload: schemas.ApplicationCreate, db: Session = Depends(get_db)
):
    if payload.status not in models.APPLICATION_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {models.APPLICATION_STATUSES}")
    if not db.get(models.Researcher, payload.researcher_id):
        raise HTTPException(404, "Researcher not found")
    if not db.get(models.Position, payload.position_id):
        raise HTTPException(404, "Position not found")

    existing = (
        db.query(models.Application)
        .filter(
            models.Application.researcher_id == payload.researcher_id,
            models.Application.position_id == payload.position_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "You already have an application for this position")

    application = models.Application(**payload.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/{application_id}", response_model=schemas.Application)
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = db.get(models.Application, application_id)
    if not application:
        raise HTTPException(404, "Application not found")
    return application


@router.put("/{application_id}", response_model=schemas.Application)
def update_application(
    application_id: int,
    payload: schemas.ApplicationUpdate,
    db: Session = Depends(get_db),
):
    application = db.get(models.Application, application_id)
    if not application:
        raise HTTPException(404, "Application not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in models.APPLICATION_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {models.APPLICATION_STATUSES}")
    for key, value in data.items():
        setattr(application, key, value)
    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", status_code=204)
def delete_application(application_id: int, db: Session = Depends(get_db)):
    application = db.get(models.Application, application_id)
    if not application:
        raise HTTPException(404, "Application not found")
    db.delete(application)
    db.commit()
