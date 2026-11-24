"""Modelos ORM SQLAlchemy 2.0 representando todas as entidades do ProjetosITPS."""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StatusOption(Base):
    """Catálogo global de status compartilhado entre as metas de todos os projetos."""

    __tablename__ = "status_options"
    __table_args__ = (
        CheckConstraint(
            "tone IN ('planned', 'progress', 'done', 'alert', 'neutral')",
            name="ck_status_options_tone",
        ),
        # Garante unicidade semântica ignorando maiúsculas/minúsculas diretamente no banco.
        Index("uq_status_options_label_lower", text("lower(label)"), unique=True),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    tone: Mapped[str] = mapped_column(String(20), nullable=False)

    metas: Mapped[list["Meta"]] = relationship(back_populates="status_option")


class Projeto(Base):
    """Projeto de pesquisa ou extensão exibido na Visão Geral e detalhado no Plano de Trabalho."""

    __tablename__ = "projetos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    edital: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    objetivo: Mapped[str] = mapped_column(Text, nullable=False, default="")
    impacto: Mapped[str] = mapped_column(Text, nullable=False, default="")
    inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    supervisor: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # Nome da pasta criada no servidor de arquivos para centralizar os anexos deste projeto.
    pasta: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # Caminho relativo do relatório final dentro do diretório base de armazenamento.
    relatorio: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Ordenação explícita preserva a sequência de criação/exibição nas tabelas e formulários.
    bolsistas: Mapped[list["Bolsista"]] = relationship(
        back_populates="projeto",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Bolsista.ordem",
    )
    metas: Mapped[list["Meta"]] = relationship(
        back_populates="projeto",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Meta.ordem",
    )
    acompanhamentos: Mapped[list["Acompanhamento"]] = relationship(
        back_populates="projeto",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Acompanhamento.ordem",
    )
    custos: Mapped[list["Custo"]] = relationship(
        back_populates="projeto",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Custo.ordem",
    )


class Bolsista(Base):
    """Integrante bolsista vinculado a um projeto (ex.: DTR, DTI 1, IC, Extensão)."""

    __tablename__ = "bolsistas"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    projeto_id: Mapped[str] = mapped_column(
        ForeignKey("projetos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    modalidade: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    nome: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    projeto: Mapped["Projeto"] = relationship(back_populates="bolsistas")


class Meta(Base):
    """Meta do plano de trabalho com controle independente de semestres ativos e concluídos."""

    __tablename__ = "metas"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    projeto_id: Mapped[str] = mapped_column(
        ForeignKey("projetos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    codigo: Mapped[str] = mapped_column(String(20), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # RESTRICT impede excluir um status enquanto houver metas apontando para ele sem substituição.
    status_id: Mapped[str] = mapped_column(
        ForeignKey("status_options.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Armazenados separadamente para garantir que semestres inativos nunca afetem o percentual.
    semestres: Mapped[list[bool]] = mapped_column(JSON, nullable=False)
    semestres_ativos: Mapped[list[bool]] = mapped_column(JSON, nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    projeto: Mapped["Projeto"] = relationship(back_populates="metas")
    status_option: Mapped["StatusOption"] = relationship(back_populates="metas")


class Acompanhamento(Base):
    """Registro cronológico de acompanhamento temporal, justificativas e quantidade de anexos."""

    __tablename__ = "acompanhamentos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    projeto_id: Mapped[str] = mapped_column(
        ForeignKey("projetos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    data: Mapped[date | None] = mapped_column(Date, nullable=True)
    descricao: Mapped[str] = mapped_column(Text, nullable=False, default="")
    justificativa: Mapped[str] = mapped_column(Text, nullable=False, default="")
    anexos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    projeto: Mapped["Projeto"] = relationship(back_populates="acompanhamentos")
    anexos_lista: Mapped[list["AcompanhamentoAnexo"]] = relationship(
        back_populates="acompanhamento",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AcompanhamentoAnexo.created_at",
    )


class AcompanhamentoAnexo(Base):
    """Metadados e caminho relativo de cada arquivo anexado a um acompanhamento temporal."""

    __tablename__ = "acompanhamento_anexos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    acompanhamento_id: Mapped[str] = mapped_column(
        ForeignKey("acompanhamentos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nome_original: Mapped[str] = mapped_column(String(255), nullable=False)
    caminho: Mapped[str] = mapped_column(String(500), nullable=False)
    tamanho: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    acompanhamento: Mapped["Acompanhamento"] = relationship(back_populates="anexos_lista")


class Custo(Base):
    """Despesa ou investimento do projeto classificado como material de Consumo ou Permanente."""

    __tablename__ = "custos"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('Consumo', 'Permanente')",
            name="ck_custos_tipo",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    projeto_id: Mapped[str] = mapped_column(
        ForeignKey("projetos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    data: Mapped[date | None] = mapped_column(Date, nullable=True)
    material: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="Consumo")
    valor: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    projeto: Mapped["Projeto"] = relationship(back_populates="custos")


class User(Base):
    """Usuário autenticado do sistema com perfil administrador (`admin`), editor (`editor`) ou leitor (`user`)."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'editor', 'user')",
            name="ck_users_role",
        ),
        # Impede cadastros duplicados com o mesmo nome de usuário em maiúsculas/minúsculas diferentes.
        Index("uq_users_username_lower", text("lower(username)"), unique=True),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    username: Mapped[str] = mapped_column(String(60), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
