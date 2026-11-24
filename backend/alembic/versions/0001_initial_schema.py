"""Esquema inicial do banco de dados ProjetosITPS.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-24 09:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "status_options",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("label", sa.String(length=60), nullable=False),
        sa.Column("tone", sa.String(length=20), nullable=False),
        sa.CheckConstraint(
            "tone IN ('planned', 'progress', 'done', 'alert', 'neutral')",
            name="ck_status_options_tone",
        ),
    )
    # Garante unicidade de nomes ignorando maiúsculas/minúsculas em nível de banco.
    op.create_index(
        "uq_status_options_label_lower",
        "status_options",
        [sa.text("lower(label)")],
        unique=True,
    )

    op.create_table(
        "projetos",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("edital", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("objetivo", sa.Text(), nullable=False, server_default=""),
        sa.Column("impacto", sa.Text(), nullable=False, server_default=""),
        sa.Column("inicio", sa.Date(), nullable=True),
        sa.Column("fim", sa.Date(), nullable=True),
        sa.Column("supervisor", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("relatorio", sa.String(length=255), nullable=True),
    )

    op.create_table(
        "bolsistas",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "projeto_id",
            sa.String(length=64),
            sa.ForeignKey("projetos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("modalidade", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("nome", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_bolsistas_projeto_id", "bolsistas", ["projeto_id"])

    op.create_table(
        "metas",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "projeto_id",
            sa.String(length=64),
            sa.ForeignKey("projetos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("codigo", sa.String(length=20), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "status_id",
            sa.String(length=64),
            sa.ForeignKey("status_options.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("semestres", sa.JSON(), nullable=False),
        sa.Column("semestres_ativos", sa.JSON(), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_metas_projeto_id", "metas", ["projeto_id"])
    op.create_index("ix_metas_status_id", "metas", ["status_id"])

    op.create_table(
        "acompanhamentos",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "projeto_id",
            sa.String(length=64),
            sa.ForeignKey("projetos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("data", sa.Date(), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=False, server_default=""),
        sa.Column("justificativa", sa.Text(), nullable=False, server_default=""),
        sa.Column("anexos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_acompanhamentos_projeto_id", "acompanhamentos", ["projeto_id"])

    op.create_table(
        "custos",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "projeto_id",
            sa.String(length=64),
            sa.ForeignKey("projetos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("data", sa.Date(), nullable=True),
        sa.Column("material", sa.Text(), nullable=False, server_default=""),
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="Consumo"),
        sa.Column("valor", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("tipo IN ('Consumo', 'Permanente')", name="ck_custos_tipo"),
    )
    op.create_index("ix_custos_projeto_id", "custos", ["projeto_id"])


def downgrade() -> None:
    op.drop_index("ix_custos_projeto_id", table_name="custos")
    op.drop_table("custos")

    op.drop_index("ix_acompanhamentos_projeto_id", table_name="acompanhamentos")
    op.drop_table("acompanhamentos")

    op.drop_index("ix_metas_status_id", table_name="metas")
    op.drop_index("ix_metas_projeto_id", table_name="metas")
    op.drop_table("metas")

    op.drop_index("ix_bolsistas_projeto_id", table_name="bolsistas")
    op.drop_table("bolsistas")

    op.drop_table("projetos")

    op.drop_index("uq_status_options_label_lower", table_name="status_options")
    op.drop_table("status_options")
