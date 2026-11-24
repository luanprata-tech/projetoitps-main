"""Configuração do engine SQLAlchemy 2.0 e fábrica de sessões por requisição."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Classe base declarativa compartilhada por todos os modelos ORM."""


# pool_pre_ping evita falhas após reinícios ou ociosidade prolongada do PostgreSQL.
engine = create_engine(settings.database_url, pool_pre_ping=True)

# expire_on_commit=False preserva atributos carregados após o commit para serialização Pydantic.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Fornece uma sessão de banco isolada por requisição HTTP e garante seu fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
