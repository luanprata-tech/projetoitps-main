"""Rotas REST para gerenciamento do catálogo global de status das metas."""

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.schemas.status import (
    StatusCreateSchema,
    StatusDeleteResponseSchema,
    StatusDeleteSchema,
    StatusOptionSchema,
    StatusUpdateSchema,
)
from app.services import status_service

router = APIRouter(
    prefix="/api/statuses",
    tags=["Status"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[StatusOptionSchema])
def list_statuses(db: Session = Depends(get_db)):
    """Retorna todas as opções globais de status compartilhadas entre os projetos."""
    return status_service.list_statuses(db)


@router.post(
    "",
    response_model=StatusOptionSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_status(payload: StatusCreateSchema, db: Session = Depends(get_db)):
    """Adiciona uma nova opção de status impedindo duplicidade case-insensitive."""
    return status_service.create_status(db, payload)


@router.put(
    "/{status_id}",
    response_model=StatusOptionSchema,
    dependencies=[Depends(require_editor)],
)
def update_status(
    status_id: str,
    payload: StatusUpdateSchema,
    db: Session = Depends(get_db),
):
    """Edita nome e cor mantendo o ID estável para preservar referências das metas."""
    return status_service.update_status(db, status_id, payload)


@router.delete(
    "/{status_id}",
    response_model=StatusDeleteResponseSchema,
    dependencies=[Depends(require_editor)],
)
def delete_status(
    status_id: str,
    substitute_status_id: str | None = Query(default=None),
    payload: StatusDeleteSchema | None = Body(default=None),
    db: Session = Depends(get_db),
):
    """Remove um status e transfere atomicamente eventuais metas para o status substituto."""
    replacement_id = substitute_status_id or (
        payload.substitute_status_id if payload is not None else None
    )
    statuses, reassigned = status_service.delete_status(db, status_id, replacement_id)
    return StatusDeleteResponseSchema(statuses=statuses, reassigned_goals=reassigned)
