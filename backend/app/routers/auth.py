"""Rotas de autenticação por credenciais e emissão de token JWT."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, UserOut
from app.services import user_service

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Autentica o usuário e retorna um JWT válido por 1 hora (JWT_EXPIRE_MINUTES)."""
    user = user_service.authenticate_user(db, payload.username, payload.password)
    token, expires_at = create_access_token(user.id, user.role)
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        expires_at=expires_at,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário autenticado para validar a sessão no carregamento do app."""
    return current_user
