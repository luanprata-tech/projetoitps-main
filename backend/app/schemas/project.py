"""Schemas Pydantic v2 para projetos, bolsistas, metas, acompanhamentos e custos."""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import PurePosixPath
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.services.storage_service import format_network_path


def _parse_optional_date(value: Any) -> date | None:
    """Converte strings vazias do formulário HTML em None antes da validação de data."""
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError("Data inválida.")


def _serialize_date_str(value: Any) -> str:
    """Mantém compatibilidade com os inputs do frontend, que esperam '' quando não há data."""
    if value is None:
        return ""
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _validate_semestres_tuple(value: list[bool]) -> list[bool]:
    """Garante exatamente 4 posições representando os 4 semestres do plano de trabalho."""
    if len(value) != 4:
        raise ValueError("Os semestres devem conter exatamente 4 posições.")
    return [bool(item) for item in value]


class BolsistaSchema(BaseModel):
    """Representação de um bolsista associado ao projeto."""

    model_config = ConfigDict(from_attributes=True)

    modalidade: str = ""
    nome: str = ""

    @field_validator("modalidade", "nome")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class MetaOut(BaseModel):
    """Serialização de meta alinhada ao contrato do frontend (`semestresAtivos` e `status`)."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    codigo: str
    descricao: str
    semestres: list[bool]
    semestresAtivos: list[bool] = Field(validation_alias="semestres_ativos")
    status: str = Field(validation_alias="status_id")


class MetaCreate(BaseModel):
    """Payload opcionalmente configurável ao adicionar uma nova meta ao projeto."""

    model_config = ConfigDict(populate_by_name=True)

    codigo: str | None = Field(default=None, max_length=20)
    descricao: str = ""
    semestres: list[bool] = Field(default_factory=lambda: [False, False, False, False])
    semestresAtivos: list[bool] = Field(
        default_factory=lambda: [True, True, True, True],
        alias="semestres_ativos",
    )
    status: str | None = Field(default=None, alias="status_id")

    @field_validator("semestres", "semestresAtivos")
    @classmethod
    def check_semestres(cls, value: list[bool]) -> list[bool]:
        return _validate_semestres_tuple(value)


class MetaUpdate(BaseModel):
    """Atualização parcial inline de uma meta do plano de trabalho."""

    model_config = ConfigDict(populate_by_name=True)

    codigo: str | None = Field(default=None, max_length=20)
    descricao: str | None = None
    semestres: list[bool] | None = None
    semestresAtivos: list[bool] | None = Field(default=None, alias="semestres_ativos")
    status: str | None = Field(default=None, alias="status_id")

    @model_validator(mode="before")
    @classmethod
    def accept_camel_and_snake_keys(cls, data: Any) -> Any:
        """Aceita tanto `semestresAtivos`/`status` (frontend) quanto `semestres_ativos`/`status_id`."""
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if "semestresAtivos" in normalized and "semestres_ativos" not in normalized:
            normalized["semestres_ativos"] = normalized["semestresAtivos"]
        if "status" in normalized and "status_id" not in normalized:
            normalized["status_id"] = normalized["status"]
        return normalized

    @field_validator("semestres", "semestresAtivos")
    @classmethod
    def check_optional_semestres(cls, value: list[bool] | None) -> list[bool] | None:
        if value is None:
            return None
        return _validate_semestres_tuple(value)


class AnexoOut(BaseModel):
    """Metadados públicos de um arquivo salvo na pasta de rede do projeto."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    nome: str = Field(validation_alias="nome_original")
    caminho: str
    tamanho: int

    @computed_field
    @property
    def caminhoRede(self) -> str:
        return format_network_path(self.caminho) or self.caminho


class AcompanhamentoOut(BaseModel):
    """Serialização de registro de acompanhamento temporal com lista de anexos armazenados."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    data: str
    descricao: str
    justificativa: str
    anexos: int
    anexosLista: list[AnexoOut] = Field(default_factory=list, validation_alias="anexos_lista")

    @field_validator("data", mode="before")
    @classmethod
    def format_data(cls, value: Any) -> str:
        return _serialize_date_str(value)


class AcompanhamentoCreate(BaseModel):
    """Payload para inclusão de registro de acompanhamento temporal."""

    data: date | None = None
    descricao: str = ""
    justificativa: str = ""
    anexos: int = Field(default=0, ge=0)

    @field_validator("data", mode="before")
    @classmethod
    def parse_data(cls, value: Any) -> date | None:
        return _parse_optional_date(value)


class AcompanhamentoUpdate(BaseModel):
    """Atualização parcial inline de acompanhamento temporal."""

    data: date | None = None
    descricao: str | None = None
    justificativa: str | None = None
    anexos: int | None = Field(default=None, ge=0)

    @field_validator("data", mode="before")
    @classmethod
    def parse_data(cls, value: Any) -> date | None:
        return _parse_optional_date(value)


class CustoOut(BaseModel):
    """Serialização de item de custo/investimento."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    data: str
    material: str
    tipo: Literal["Consumo", "Permanente"]
    valor: float

    @field_validator("data", mode="before")
    @classmethod
    def format_data(cls, value: Any) -> str:
        return _serialize_date_str(value)

    @field_validator("valor", mode="before")
    @classmethod
    def format_valor(cls, value: Any) -> float:
        return float(value)


class CustoCreate(BaseModel):
    """Payload para criação de item de custo/investimento."""

    data: date | None = None
    material: str = ""
    tipo: Literal["Consumo", "Permanente"] = "Consumo"
    valor: Decimal = Field(default=Decimal("0.00"))

    @field_validator("data", mode="before")
    @classmethod
    def parse_data(cls, value: Any) -> date | None:
        return _parse_optional_date(value)

    @field_validator("valor", mode="before")
    @classmethod
    def quantize_valor(cls, value: Any) -> Decimal:
        if value is None or value == "":
            return Decimal("0.00")
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class CustoUpdate(BaseModel):
    """Atualização parcial inline de custo/investimento."""

    data: date | None = None
    material: str | None = None
    tipo: Literal["Consumo", "Permanente"] | None = None
    valor: Decimal | None = None

    @field_validator("data", mode="before")
    @classmethod
    def parse_data(cls, value: Any) -> date | None:
        return _parse_optional_date(value)

    @field_validator("valor", mode="before")
    @classmethod
    def quantize_valor(cls, value: Any) -> Decimal | None:
        if value is None or value == "":
            return None
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ProjetoOverviewIn(BaseModel):
    """Campos de visão geral usados tanto na criação quanto na edição sem tocar nos filhos operacionais."""

    titulo: str
    edital: str = ""
    objetivo: str = ""
    impacto: str = ""
    inicio: date | None = None
    fim: date | None = None
    supervisor: str = ""
    relatorio: str | None = None
    bolsistas: list[BolsistaSchema] = Field(default_factory=list)

    @field_validator("titulo")
    @classmethod
    def check_titulo(cls, value: str) -> str:
        titulo = value.strip()
        if not titulo:
            raise ValueError("Informe o título do projeto.")
        return titulo

    @field_validator("inicio", "fim", mode="before")
    @classmethod
    def parse_dates(cls, value: Any) -> date | None:
        return _parse_optional_date(value)

    @field_validator("relatorio", mode="before")
    @classmethod
    def normalize_relatorio(cls, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None


class ProjetoOut(BaseModel):
    """Representação completa do projeto com bolsistas, metas, acompanhamentos e custos."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    edital: str
    objetivo: str
    inicio: str
    fim: str
    supervisor: str
    pasta: str = ""
    concluido: bool = False
    bolsistas: list[BolsistaSchema]
    relatorio: str | None
    impacto: str
    metas: list[MetaOut]
    acompanhamentos: list[AcompanhamentoOut]
    custos: list[CustoOut]

    @computed_field
    @property
    def relatorioNome(self) -> str | None:
        if not self.relatorio:
            return None
        return PurePosixPath(self.relatorio.replace("\\", "/")).name

    @computed_field
    @property
    def relatorioCaminhoRede(self) -> str | None:
        return format_network_path(self.relatorio)

    @field_validator("inicio", "fim", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        return _serialize_date_str(value)
