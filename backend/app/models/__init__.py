"""Exporta os modelos ORM para registro no metadata do SQLAlchemy e Alembic."""

from app.models.entities import (
    Acompanhamento,
    AcompanhamentoAnexo,
    Bolsista,
    Custo,
    Meta,
    Projeto,
    StatusOption,
    User,
)

__all__ = [
    "StatusOption",
    "Projeto",
    "Bolsista",
    "Meta",
    "Acompanhamento",
    "AcompanhamentoAnexo",
    "Custo",
    "User",
]
