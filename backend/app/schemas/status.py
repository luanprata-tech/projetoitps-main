"""Schemas Pydantic v2 para o catálogo global de status das metas."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

StatusTone = Literal["planned", "progress", "done", "alert", "neutral"]


def _validate_status_label(value: str) -> str:
    """Normaliza espaços e garante que o nome do status respeite os limites da regra de negócio."""
    label = value.strip()
    if not label:
        raise ValueError("Informe o nome do status.")
    if len(label) > 60:
        raise ValueError("O nome do status deve ter no máximo 60 caracteres.")
    return label


class StatusOptionSchema(BaseModel):
    """Representação pública de uma opção de status."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    tone: StatusTone


class StatusCreateSchema(BaseModel):
    """Dados aceitos para criação de um novo status no catálogo global."""

    id: str | None = Field(default=None, max_length=64)
    label: str
    tone: StatusTone

    @field_validator("label")
    @classmethod
    def check_label(cls, value: str) -> str:
        return _validate_status_label(value)


class StatusUpdateSchema(BaseModel):
    """Dados aceitos para renomear ou alterar a cor mantendo o ID de referência estável."""

    label: str
    tone: StatusTone

    @field_validator("label")
    @classmethod
    def check_label(cls, value: str) -> str:
        return _validate_status_label(value)


class StatusDeleteSchema(BaseModel):
    """Payload opcional para informar o status substituto ao remover um status em uso."""

    substitute_status_id: str | None = None


class StatusDeleteResponseSchema(BaseModel):
    """Retorno após remoção atômica de status com a lista atualizada e total de metas migradas."""

    statuses: list[StatusOptionSchema]
    reassigned_goals: int
