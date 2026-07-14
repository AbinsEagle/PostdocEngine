from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Researcher / profile
# ---------------------------------------------------------------------------
class ResearcherBase(BaseModel):
    name: str
    email: str
    field: str = ""
    institution: str = ""
    keywords: str = ""
    bio: str = ""


class ResearcherCreate(ResearcherBase):
    pass


class ResearcherUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    field: str | None = None
    institution: str | None = None
    keywords: str | None = None
    bio: str | None = None


class Researcher(ResearcherBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Position
# ---------------------------------------------------------------------------
class PositionBase(BaseModel):
    title: str
    institution: str
    field: str = ""
    location: str = ""
    keywords: str = ""
    description: str = ""
    salary_min: int | None = None
    salary_max: int | None = None
    deadline: date | None = None
    url: str = ""
    source: str = ""
    posted_at: date | None = None


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    title: str | None = None
    institution: str | None = None
    field: str | None = None
    location: str | None = None
    keywords: str | None = None
    description: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    deadline: date | None = None
    url: str | None = None
    source: str | None = None
    posted_at: date | None = None


class Position(PositionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
class ApplicationBase(BaseModel):
    researcher_id: int
    position_id: int
    status: str = "interested"
    notes: str = ""
    applied_date: date | None = None
    next_action: str = ""
    next_action_date: date | None = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    applied_date: date | None = None
    next_action: str | None = None
    next_action_date: date | None = None


class Application(ApplicationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    position: Position | None = None


# ---------------------------------------------------------------------------
# Research items
# ---------------------------------------------------------------------------
class ResearchItemBase(BaseModel):
    researcher_id: int
    title: str
    type: str = "note"
    status: str = "idea"
    notes: str = ""
    url: str = ""


class ResearchItemCreate(ResearchItemBase):
    pass


class ResearchItemUpdate(BaseModel):
    title: str | None = None
    type: str | None = None
    status: str | None = None
    notes: str | None = None
    url: str | None = None


class ResearchItem(ResearchItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------
class Recommendation(BaseModel):
    position: Position
    score: float = Field(..., description="Match score between 0 and 1")
    matched_keywords: list[str]
    reason: str
