"""Schemas Pydantic v2 para autenticação JWT e gerenciamento de usuários."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

UserRole = Literal["admin", "editor", "user"]


def _normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not username:
        raise ValueError("Informe o nome de usuário.")
    if len(username) < 3:
        raise ValueError("O nome de usuário deve ter pelo menos 3 caracteres.")
    if len(username) > 60:
        raise ValueError("O nome de usuário deve ter no máximo 60 caracteres.")
    if any(ch.isspace() for ch in username):
        raise ValueError("O nome de usuário não pode conter espaços.")
    return username


def _normalize_name(value: str) -> str:
    nome = value.strip()
    if not nome:
        raise ValueError("Informe o nome do usuário.")
    if len(nome) > 150:
        raise ValueError("O nome deve ter no máximo 150 caracteres.")
    return nome


def _validate_password(value: str) -> str:
    if len(value) < 6:
        raise ValueError("A senha deve ter pelo menos 6 caracteres.")
    return value


class UserOut(BaseModel):
    """Representação pública de usuário sem expor o hash da senha."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    username: str
    role: UserRole
    ativo: bool
    created_at: datetime


class LoginRequest(BaseModel):
    """Credenciais enviadas na tela de login."""

    username: str
    password: str

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return value.strip().lower()


class LoginResponse(BaseModel):
    """Resposta de autenticação contendo o token JWT, expiração e dados do usuário."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    expires_at: datetime
    user: UserOut


class UserCreate(BaseModel):
    """Dados para criação de um novo usuário pelo administrador."""

    nome: str
    username: str
    password: str = Field(min_length=6)
    role: UserRole = "user"
    ativo: bool = True

    @field_validator("nome")
    @classmethod
    def check_nome(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return _normalize_username(value)

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return _validate_password(value)


class UserUpdate(BaseModel):
    """Dados editáveis de um usuário existente na tela de gerenciamento."""

    nome: str
    username: str
    role: UserRole
    ativo: bool

    @field_validator("nome")
    @classmethod
    def check_nome(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return _normalize_username(value)


class ResetPasswordRequest(BaseModel):
    """Nova senha definida pelo administrador ao resetar as credenciais de um usuário."""

    new_password: str = Field(min_length=6)

    @field_validator("new_password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return _validate_password(value)
