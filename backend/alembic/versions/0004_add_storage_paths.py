"""Adiciona pasta do projeto e tabela de anexos de acompanhamento com caminhos em disco.

Revision ID: 0004_add_storage_paths
Revises: 0003_rename_email_to_username
Create Date: 2026-11-24 10:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_add_storage_paths"
down_revision: Union[str, Sequence[str], None] = "0003_rename_email_to_username"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projetos",
        sa.Column("pasta", sa.String(length=255), nullable=False, server_default=""),
    )
    op.alter_column(
        "projetos",
        "relatorio",
        existing_type=sa.String(length=255),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
    op.create_table(
        "acompanhamento_anexos",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "acompanhamento_id",
            sa.String(length=64),
            sa.ForeignKey("acompanhamentos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nome_original", sa.String(length=255), nullable=False),
        sa.Column("caminho", sa.String(length=500), nullable=False),
        sa.Column("tamanho", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_acompanhamento_anexos_acompanhamento_id",
        "acompanhamento_anexos",
        ["acompanhamento_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_acompanhamento_anexos_acompanhamento_id",
        table_name="acompanhamento_anexos",
    )
    op.drop_table("acompanhamento_anexos")
    op.alter_column(
        "projetos",
        "relatorio",
        existing_type=sa.String(length=500),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    op.drop_column("projetos", "pasta")
