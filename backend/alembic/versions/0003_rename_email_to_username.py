"""Substitui a credencial de e-mail por nome de usuário (username) na tabela users.

Revision ID: 0003_rename_email_to_username
Revises: 0002_add_users_table
Create Date: 2026-11-24 09:50:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_rename_email_to_username"
down_revision: Union[str, Sequence[str], None] = "0002_add_users_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("uq_users_email_lower", table_name="users")
    op.alter_column(
        "users",
        "email",
        new_column_name="username",
        existing_type=sa.String(length=255),
        type_=sa.String(length=60),
        existing_nullable=False,
    )
    # Atualiza o administrador padrão caso já tenha sido criado com o formato anterior de e-mail.
    op.execute(
        "UPDATE users SET username = 'admin' WHERE id = 'admin-default' AND username = 'admin@itps.local'"
    )
    op.create_index(
        "uq_users_username_lower",
        "users",
        [sa.text("lower(username)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_users_username_lower", table_name="users")
    op.alter_column(
        "users",
        "username",
        new_column_name="email",
        existing_type=sa.String(length=60),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
    op.create_index(
        "uq_users_email_lower",
        "users",
        [sa.text("lower(email)")],
        unique=True,
    )
