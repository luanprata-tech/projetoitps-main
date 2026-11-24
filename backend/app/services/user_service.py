"""Serviço de autenticação e gerenciamento de usuários pelo administrador."""

from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import User
from app.schemas.auth import UserCreate, UserUpdate


def _ensure_unique_username(db: Session, username: str, ignore_id: str | None = None) -> None:
    """Impede duplicidade de nome de usuário ignorando diferenças de maiúsculas e minúsculas."""
    normalized = username.casefold()
    existing = db.scalars(select(User)).all()
    for user in existing:
        if ignore_id is not None and user.id == ignore_id:
            continue
        if user.username.casefold() == normalized:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um usuário cadastrado com esse nome de usuário.",
            )


def _count_other_active_admins(db: Session, exclude_user_id: str) -> int:
    """Conta quantos administradores ativos restariam sem o usuário informado."""
    return (
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "admin", User.ativo.is_(True), User.id != exclude_user_id)
        )
        or 0
    )


def authenticate_user(db: Session, username: str, password: str) -> User:
    """Valida nome de usuário, senha e status ativo antes de emitir o token JWT."""
    normalized = username.strip().casefold()
    user = db.scalars(select(User).where(func.lower(User.username) == normalized)).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado. Contate o administrador.",
        )
    return user


def list_users(db: Session) -> list[User]:
    """Lista todos os usuários ordenados pela data de criação."""
    return list(db.scalars(select(User).order_by(User.created_at.asc())).all())


def create_user(db: Session, payload: UserCreate) -> User:
    """Cria um novo usuário (comum ou administrador) com senha protegida por hash scrypt."""
    _ensure_unique_username(db, payload.username)
    user = User(
        id=uuid4().hex[:12],
        nome=payload.nome,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        ativo=payload.ativo,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    user_id: str,
    payload: UserUpdate,
    acting_user_id: str,
) -> User:
    """Atualiza dados cadastrais, perfil e status ativo protegendo contra bloqueio do último admin."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )

    _ensure_unique_username(db, payload.username, ignore_id=user_id)

    if user.id == acting_user_id:
        if not payload.ativo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você não pode desativar sua própria conta.",
            )
        if payload.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você não pode remover seu próprio perfil de administrador.",
            )

    removing_admin_access = user.role == "admin" and user.ativo and (
        payload.role != "admin" or not payload.ativo
    )
    if removing_admin_access and _count_other_active_admins(db, user.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mantenha pelo menos um administrador ativo no sistema.",
        )

    user.nome = payload.nome
    user.username = payload.username
    user.role = payload.role
    user.ativo = payload.ativo
    db.commit()
    db.refresh(user)
    return user


def reset_user_password(db: Session, user_id: str, new_password: str) -> User:
    """Redefine a senha de um usuário existente."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )
    user.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: str, acting_user_id: str) -> None:
    """Remove um usuário impedindo autoexclusão ou remoção do último administrador ativo."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )

    if user.id == acting_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode excluir sua própria conta.",
        )

    if user.role == "admin" and user.ativo and _count_other_active_admins(db, user.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mantenha pelo menos um administrador ativo no sistema.",
        )

    db.delete(user)
    db.commit()
