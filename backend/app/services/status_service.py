"""Serviço de gerenciamento do catálogo global de status e reatribuição atômica de metas."""

from uuid import uuid4

from fastapi import HTTPException, status as http_status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Meta, StatusOption
from app.schemas.status import StatusCreateSchema, StatusUpdateSchema


def list_statuses(db: Session) -> list[StatusOption]:
    """Lista todas as opções de status preservando uma ordenação estável de inserção."""
    return list(db.scalars(select(StatusOption)).all())


def _ensure_unique_label(db: Session, label: str, ignore_id: str | None = None) -> None:
    """Impede nomes duplicados em pt-BR ignorando diferenças de maiúsculas e minúsculas."""
    normalized = label.casefold()
    existing = db.scalars(select(StatusOption)).all()
    for item in existing:
        if ignore_id is not None and item.id == ignore_id:
            continue
        if item.label.casefold() == normalized:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Já existe um status com esse nome.",
            )


def create_status(db: Session, payload: StatusCreateSchema) -> StatusOption:
    """Cria um novo status global validando unicidade case-insensitive do rótulo."""
    _ensure_unique_label(db, payload.label)
    status_id = (payload.id or "").strip() or uuid4().hex[:12]
    if db.get(StatusOption, status_id) is not None:
        status_id = uuid4().hex[:12]

    option = StatusOption(id=status_id, label=payload.label, tone=payload.tone)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


def update_status(db: Session, status_id: str, payload: StatusUpdateSchema) -> StatusOption:
    """Atualiza rótulo e cor semântica mantendo o ID estável para não quebrar referências."""
    option = db.get(StatusOption, status_id)
    if option is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Status não encontrado.",
        )

    _ensure_unique_label(db, payload.label, ignore_id=status_id)
    option.label = payload.label
    option.tone = payload.tone
    db.commit()
    db.refresh(option)
    return option


def delete_status(
    db: Session,
    status_id: str,
    substitute_status_id: str | None = None,
) -> tuple[list[StatusOption], int]:
    """Remove um status garantindo ao menos 1 restante e migrando metas em transação atômica."""
    option = db.get(StatusOption, status_id)
    if option is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Status não encontrado.",
        )

    total_statuses = db.scalar(select(func.count()).select_from(StatusOption)) or 0
    if total_statuses <= 1:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Mantenha pelo menos um status.",
        )

    affected_goals = (
        db.scalar(select(func.count()).select_from(Meta).where(Meta.status_id == status_id))
        or 0
    )

    replacement: StatusOption | None = None
    if affected_goals > 0 or substitute_status_id:
        if not substitute_status_id or substitute_status_id == status_id:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Escolha um status substituto.",
            )
        replacement = db.get(StatusOption, substitute_status_id)
        if replacement is None:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Escolha um status substituto.",
            )

    try:
        # Atualiza somente status_id para preservar intactos os semestres e o progresso das metas.
        if affected_goals > 0 and replacement is not None:
            db.execute(
                update(Meta)
                .where(Meta.status_id == status_id)
                .values(status_id=replacement.id)
            )
        db.delete(option)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return list_statuses(db), affected_goals
