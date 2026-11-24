"""Seed idempotente dos 3 status padrão e do administrador inicial do ProjetosITPS."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import StatusOption, User


def seed_initial_data(db: Session) -> bool:
    """Popula status padrão e administrador inicial de forma independente e idempotente."""
    changed = False

    status_count = db.scalar(select(func.count()).select_from(StatusOption)) or 0
    if status_count == 0:
        db.add_all(
            [
                StatusOption(id="Planejado", label="Planejado", tone="planned"),
                StatusOption(id="Em Andamento", label="Em Andamento", tone="progress"),
                StatusOption(id="Concluído", label="Concluído", tone="done"),
            ]
        )
        changed = True

    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    if user_count == 0:
        # Garante acesso administrativo inicial sem depender de inserção manual no banco.
        db.add(
            User(
                id="admin-default",
                nome=settings.default_admin_name,
                username=settings.default_admin_username.strip().lower(),
                password_hash=hash_password(settings.default_admin_password),
                role="admin",
                ativo=True,
            )
        )
        changed = True

    if changed:
        db.commit()
    return changed
