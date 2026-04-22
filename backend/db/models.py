from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.database import Base


class Thread(Base):
    __tablename__ = "threads"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    product = Column(String)
    description = Column(Text)
    status = Column(String, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    competitors_count = Column(Integer, default=0)
    tags = Column(JSON, default=[])
    competitors = Column(JSON, default=[])

    # Relationships
    run = relationship("Run", back_populates="thread", uselist=False, cascade="all, delete-orphan")
    insight = relationship("Insight", back_populates="thread", uselist=False, cascade="all, delete-orphan", primaryjoin="Thread.id == Insight.id")


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, ForeignKey("threads.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    status = Column(String, default="running")
    current_url = Column(String)
    progress = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    thread = relationship("Thread", back_populates="run")
    logs = relationship("Log", back_populates="run", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="run", cascade="all, delete-orphan")


class Log(Base):
    __tablename__ = "logs"

    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    message = Column(Text)
    type = Column(String) # info, success, warning, error
    timestamp = Column(String) # For display purposes
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    run = relationship("Run", back_populates="logs")


class Signal(Base):
    __tablename__ = "signals"

    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    type = Column(String) # price, hiring, feature, alert
    title = Column(String)
    description = Column(Text)
    time = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    run = relationship("Run", back_populates="signals")


class Insight(Base):
    __tablename__ = "insights"

    id = Column(String, ForeignKey("threads.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String)
    product = Column(String)
    score = Column(Integer)
    completed_at = Column(String)
    data = Column(JSON) # The full report

    thread = relationship("Thread", back_populates="insight", foreign_keys=[id])


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    config = Column(JSON) # {url, tags, trackWhat, intervalSeconds}
    status = Column(String, default="idle")
    runs = Column(JSON, default=[]) # Historical runs
    insights = Column(JSON, default={}) # Diff insights
    last_run_at = Column(DateTime(timezone=True))
    run_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scheduled_actions = relationship("StrategicAction", back_populates="monitor", cascade="all, delete-orphan")


class StrategicAction(Base):
    __tablename__ = "strategic_actions"

    id = Column(String, primary_key=True, index=True)
    monitor_id = Column(String, ForeignKey("monitors.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="scheduled") # scheduled, completed
    scheduled_date = Column(String)
    tasks = Column(JSON) # [{title, duration, completed}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    monitor = relationship("Monitor", back_populates="scheduled_actions")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True) # Supabase user ID
    email = Column(String, unique=True, index=True)
    credits = Column(Float, default=20.0)
    plan_type = Column(String, default="free") # free, pro
    max_credits = Column(Integer, default=30)
    last_reset_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Stats
    total_runs = Column(Integer, default=0)
    total_competitors = Column(Integer, default=0)
    total_signals = Column(Integer, default=0)


class GlobalStats(Base):
    __tablename__ = "global_stats"

    id = Column(Integer, primary_key=True, default=1)
    total_runs = Column(Integer, default=0)
    total_competitors = Column(Integer, default=0)
    total_signals = Column(Integer, default=0)
    total_users = Column(Integer, default=0)