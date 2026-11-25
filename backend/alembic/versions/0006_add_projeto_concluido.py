"""Adiciona coluna booleana concluido na tabela projetos.

Revision ID: 0006_add_projeto_concluido
Revises: 0005_add_editor_role
Create Date: 2026-11-25 12:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_add_projeto_concluido"
down_revision: Union[str, Sequence[str], None] = "0005_add_editor_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projetos",
        sa.Column(
            "concluido",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("projetos", "concluido")
