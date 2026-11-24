"""Rotas administrativas para listagem, criação, edição, reset de senha e remoção de usuários."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models import User
from app.schemas.auth import ResetPasswordRequest, UserCreate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(
    prefix="/api/users",
    tags=["Usuários"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    """Lista todos os usuários cadastrados (restrito a administradores)."""
    return user_service.list_users(db)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Cadastra um novo usuário comum ou administrador."""
    return user_service.create_user(db, payload)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Atualiza nome, e-mail, perfil e status ativo de um usuário."""
    return user_service.update_user(db, user_id, payload, acting_user_id=current_admin.id)


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Redefine a senha de acesso de um usuário."""
    return user_service.reset_user_password(db, user_id, payload.new_password)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Exclui um usuário (exceto a própria conta ou o último administrador ativo)."""
    user_service.delete_user(db, user_id, acting_user_id=current_admin.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
