"""Adiciona o perfil 'editor' na constraint de papéis da tabela users.

Revision ID: 0005_add_editor_role
Revises: 0004_add_storage_paths
Create Date: 2026-11-24 12:06:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005_add_editor_role"
down_revision: Union[str, Sequence[str], None] = "0004_add_storage_paths"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'editor', 'user')",
    )


def downgrade() -> None:
    # Converte eventuais editores para usuário comum antes de restringir a constraint novamente.
    op.execute("UPDATE users SET role = 'user' WHERE role = 'editor'")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'user')",
    )
