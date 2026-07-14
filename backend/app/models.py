from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Application lifecycle stages, in order.
APPLICATION_STATUSES = [
    "interested",
    "applied",
    "interview",
    "offer",
    "accepted",
    "rejected",
    "declined",
]

# Research item categories.
RESEARCH_TYPES = ["paper", "grant", "experiment", "note"]
RESEARCH_STATUSES = ["idea", "in_progress", "under_review", "published", "done"]


class Researcher(Base):
    __tablename__ = "researchers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    field: Mapped[str] = mapped_column(String(200), default="")
    institution: Mapped[str] = mapped_column(String(200), default="")
    # Comma-separated research interests, used by the match engine.
    keywords: Mapped[str] = mapped_column(Text, default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    applications: Mapped[list["Application"]] = relationship(
        back_populates="researcher", cascade="all, delete-orphan"
    )
    research_items: Mapped[list["ResearchItem"]] = relationship(
        back_populates="researcher", cascade="all, delete-orphan"
    )


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    institution: Mapped[str] = mapped_column(String(300))
    field: Mapped[str] = mapped_column(String(200), default="")
    location: Mapped[str] = mapped_column(String(200), default="")
    keywords: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    url: Mapped[str] = mapped_column(String(500), default="")
    source: Mapped[str] = mapped_column(String(200), default="")
    posted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    applications: Mapped[list["Application"]] = relationship(
        back_populates="position", cascade="all, delete-orphan"
    )


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    researcher_id: Mapped[int] = mapped_column(ForeignKey("researchers.id"))
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id"))
    status: Mapped[str] = mapped_column(String(50), default="interested")
    notes: Mapped[str] = mapped_column(Text, default="")
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_action: Mapped[str] = mapped_column(String(300), default="")
    next_action_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    researcher: Mapped["Researcher"] = relationship(back_populates="applications")
    position: Mapped["Position"] = relationship(back_populates="applications")


class ResearchItem(Base):
    __tablename__ = "research_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    researcher_id: Mapped[int] = mapped_column(ForeignKey("researchers.id"))
    title: Mapped[str] = mapped_column(String(300))
    type: Mapped[str] = mapped_column(String(50), default="note")
    status: Mapped[str] = mapped_column(String(50), default="idea")
    notes: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    researcher: Mapped["Researcher"] = relationship(back_populates="research_items")
