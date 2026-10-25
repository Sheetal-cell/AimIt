from datetime import date, datetime
from sqlalchemy import String, Text, Integer, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base
class User(Base):
    __tablename__="users"
    id: Mapped[int]=mapped_column(primary_key=True)
    email: Mapped[str]=mapped_column(String(254), unique=True, index=True, nullable=False)
    password_hash: Mapped[str]=mapped_column(String(255), nullable=False)
    display_name: Mapped[str]=mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime, default=datetime.utcnow, nullable=False)
class Goal(Base):
    __tablename__="goals"
    id: Mapped[int]=mapped_column(primary_key=True, index=True)
    user_id: Mapped[int]=mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str]=mapped_column(String(160), nullable=False)
    description: Mapped[str|None]=mapped_column(Text, nullable=True)
    category: Mapped[str]=mapped_column(String(60), default="Personal")
    target_date: Mapped[date|None]=mapped_column(Date, nullable=True)
    status: Mapped[str]=mapped_column(String(24), default="active")
    created_at: Mapped[datetime]=mapped_column(DateTime, default=datetime.utcnow, nullable=False)
class Task(Base):
    __tablename__="tasks"
    id: Mapped[int]=mapped_column(primary_key=True, index=True)
    user_id: Mapped[int]=mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str]=mapped_column(String(200), nullable=False)
    notes: Mapped[str|None]=mapped_column(Text, nullable=True)
    due_date: Mapped[date]=mapped_column(Date, nullable=False, index=True)
    priority: Mapped[str]=mapped_column(String(16), default="medium")
    estimated_minutes: Mapped[int]=mapped_column(Integer, default=30)
    completed: Mapped[bool]=mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime|None]=mapped_column(DateTime, nullable=True)
    goal_id: Mapped[int|None]=mapped_column(ForeignKey("goals.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime, default=datetime.utcnow, nullable=False)
class Milestone(Base):
    __tablename__="milestones"
    id: Mapped[int]=mapped_column(primary_key=True, index=True)
    user_id: Mapped[int]=mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str]=mapped_column(String(180), nullable=False)
    description: Mapped[str|None]=mapped_column(Text, nullable=True)
    due_date: Mapped[date|None]=mapped_column(Date, nullable=True)
    status: Mapped[str]=mapped_column(String(24), default="not_started")
    goal_id: Mapped[int]=mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime, default=datetime.utcnow, nullable=False)
class CompletionEvent(Base):
    __tablename__="completion_events"
    id: Mapped[int]=mapped_column(primary_key=True)
    user_id: Mapped[int]=mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    task_id: Mapped[int]=mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False)
    completed: Mapped[bool]=mapped_column(Boolean, nullable=False)
    occurred_at: Mapped[datetime]=mapped_column(DateTime, default=datetime.utcnow, nullable=False)
