"""Serviço de persistência de projetos e itens do plano de trabalho."""

from datetime import date
from decimal import Decimal
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status as http_status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Acompanhamento,
    AcompanhamentoAnexo,
    Bolsista,
    Custo,
    Meta,
    Projeto,
    StatusOption,
)
from app.schemas.project import (
    AcompanhamentoCreate,
    AcompanhamentoUpdate,
    CustoCreate,
    CustoUpdate,
    MetaCreate,
    MetaUpdate,
    ProjetoOverviewIn,
)
from app.services.storage_service import (
    build_acompanhamento_folder_name,
    build_project_folder_name,
    delete_stored_file,
    ensure_project_folders,
    move_stored_file,
    remove_acompanhamento_folder_if_empty,
    resolve_stored_file,
    save_uploaded_file,
)


def _new_id() -> str:
    return uuid4().hex[:12]


def _project_query():
    """Carrega antecipadamente as coleções 1:N para evitar consultas N+1 na serialização."""
    return select(Projeto).options(
        selectinload(Projeto.bolsistas),
        selectinload(Projeto.metas),
        selectinload(Projeto.acompanhamentos).selectinload(Acompanhamento.anexos_lista),
        selectinload(Projeto.custos),
    )


def list_projects(db: Session) -> list[Projeto]:
    """Lista todos os projetos com seus respectivos bolsistas, metas, acompanhamentos e custos."""
    return list(db.scalars(_project_query()).all())


def get_project_or_404(db: Session, projeto_id: str) -> Projeto:
    """Busca um projeto completo pelo ID ou lança HTTP 404."""
    projeto = db.scalars(_project_query().where(Projeto.id == projeto_id)).first()
    if projeto is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Projeto não encontrado.",
        )
    return projeto


def _ensure_project_exists(db: Session, projeto_id: str) -> Projeto:
    projeto = db.get(Projeto, projeto_id)
    if projeto is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Projeto não encontrado.",
        )
    return projeto


def _resolve_status_id(db: Session, requested_status_id: str | None) -> str:
    """Valida o status informado ou seleciona o primeiro disponível no catálogo global."""
    if requested_status_id:
        option = db.get(StatusOption, requested_status_id)
        if option is None:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Status informado não existe no catálogo.",
            )
        return option.id

    first = db.scalars(select(StatusOption)).first()
    if first is None:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Nenhum status cadastrado no catálogo.",
        )
    return first.id


def _list_existing_project_folders(db: Session) -> set[str]:
    """Retorna os nomes de pastas já associados a projetos no banco para evitar colisões."""
    rows = db.scalars(select(Projeto.pasta).where(Projeto.pasta.is_not(None))).all()
    return {folder for folder in rows if folder}


def _ensure_project_folder_assigned(db: Session, projeto: Projeto) -> str:
    """Garante que o projeto tenha uma pasta associada no banco e criada no servidor de arquivos."""
    if not projeto.pasta:
        projeto.pasta = build_project_folder_name(
            projeto.titulo,
            projeto.id,
            existing_folders=_list_existing_project_folders(db),
        )
        db.flush()
    ensure_project_folders(projeto.pasta)
    return projeto.pasta


def create_project(db: Session, payload: ProjetoOverviewIn) -> Projeto:
    """Cria um novo projeto e cria automaticamente sua pasta dedicada no servidor de arquivos."""
    projeto_id = _new_id()
    pasta = build_project_folder_name(
        payload.titulo,
        projeto_id,
        existing_folders=_list_existing_project_folders(db),
    )
    ensure_project_folders(pasta)

    projeto = Projeto(
        id=projeto_id,
        titulo=payload.titulo,
        edital=payload.edital,
        objetivo=payload.objetivo,
        impacto=payload.impacto,
        inicio=payload.inicio,
        fim=payload.fim,
        supervisor=payload.supervisor,
        pasta=pasta,
        relatorio=payload.relatorio,
    )
    projeto.bolsistas = [
        Bolsista(
            id=_new_id(),
            modalidade=b.modalidade,
            nome=b.nome,
            ordem=idx,
        )
        for idx, b in enumerate(payload.bolsistas)
    ]
    db.add(projeto)
    db.commit()
    return get_project_or_404(db, projeto.id)


def update_project_overview(
    db: Session,
    projeto_id: str,
    payload: ProjetoOverviewIn,
) -> Projeto:
    """Atualiza apenas campos de visão geral e bolsistas, preservando metas, acompanhamentos e custos."""
    projeto = get_project_or_404(db, projeto_id)
    projeto.titulo = payload.titulo
    projeto.edital = payload.edital
    projeto.objetivo = payload.objetivo
    projeto.impacto = payload.impacto
    projeto.inicio = payload.inicio
    projeto.fim = payload.fim
    projeto.supervisor = payload.supervisor
    projeto.relatorio = payload.relatorio

    # Substitui apenas os bolsistas vinculados ao formulário de visão geral; demais filhos seguem intactos.
    projeto.bolsistas = [
        Bolsista(
            id=_new_id(),
            modalidade=b.modalidade,
            nome=b.nome,
            ordem=idx,
        )
        for idx, b in enumerate(payload.bolsistas)
    ]

    db.commit()
    return get_project_or_404(db, projeto.id)


def delete_project(db: Session, projeto_id: str) -> None:
    """Remove o projeto do banco (com cascade nos filhos), preservando a pasta física no servidor."""
    projeto = _ensure_project_exists(db, projeto_id)
    # Regra de negócio: a exclusão remove apenas os registros do banco, mantendo a pasta e arquivos na rede.
    db.delete(projeto)
    db.commit()


def create_meta(db: Session, projeto_id: str, payload: MetaCreate) -> Meta:
    """Adiciona uma nova meta ao projeto gerando código sequencial (M01, M02...) quando omitido."""
    _ensure_project_exists(db, projeto_id)
    status_id = _resolve_status_id(db, payload.status)

    current_count = (
        db.scalar(select(func.count()).select_from(Meta).where(Meta.projeto_id == projeto_id))
        or 0
    )
    max_order = db.scalar(
        select(func.coalesce(func.max(Meta.ordem), -1)).where(Meta.projeto_id == projeto_id)
    )
    next_order = int(max_order if max_order is not None else -1) + 1
    codigo = (payload.codigo or "").strip() or f"M{current_count + 1:02d}"

    meta = Meta(
        id=_new_id(),
        projeto_id=projeto_id,
        codigo=codigo,
        descricao=payload.descricao,
        status_id=status_id,
        semestres=payload.semestres,
        semestres_ativos=payload.semestresAtivos,
        ordem=next_order,
    )
    db.add(meta)
    db.commit()
    db.refresh(meta)
    return meta


def update_meta(db: Session, projeto_id: str, meta_id: str, payload: MetaUpdate) -> Meta:
    """Aplica alterações parciais em uma meta existente do projeto."""
    meta = db.scalars(
        select(Meta).where(Meta.id == meta_id, Meta.projeto_id == projeto_id)
    ).first()
    if meta is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Meta não encontrada.",
        )

    fields = payload.model_fields_set
    if "codigo" in fields and payload.codigo is not None:
        meta.codigo = payload.codigo
    if "descricao" in fields and payload.descricao is not None:
        meta.descricao = payload.descricao
    if "semestres" in fields and payload.semestres is not None:
        meta.semestres = payload.semestres
    if "semestresAtivos" in fields and payload.semestresAtivos is not None:
        meta.semestres_ativos = payload.semestresAtivos
    if "status" in fields and payload.status is not None:
        meta.status_id = _resolve_status_id(db, payload.status)

    db.commit()
    db.refresh(meta)
    return meta


def delete_meta(db: Session, projeto_id: str, meta_id: str) -> None:
    """Remove uma meta do plano de trabalho."""
    meta = db.scalars(
        select(Meta).where(Meta.id == meta_id, Meta.projeto_id == projeto_id)
    ).first()
    if meta is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Meta não encontrada.",
        )
    db.delete(meta)
    db.commit()


def create_acompanhamento(
    db: Session,
    projeto_id: str,
    payload: AcompanhamentoCreate,
) -> Acompanhamento:
    """Adiciona um registro de acompanhamento temporal ao projeto."""
    _ensure_project_exists(db, projeto_id)
    max_order = db.scalar(
        select(func.coalesce(func.max(Acompanhamento.ordem), -1)).where(
            Acompanhamento.projeto_id == projeto_id
        )
    )
    next_order = int(max_order if max_order is not None else -1) + 1

    item_date = payload.data if "data" in payload.model_fields_set else date.today()
    item = Acompanhamento(
        id=_new_id(),
        projeto_id=projeto_id,
        data=item_date,
        descricao=payload.descricao,
        justificativa=payload.justificativa,
        anexos=payload.anexos,
        ordem=next_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_acompanhamento(
    db: Session,
    projeto_id: str,
    item_id: str,
    payload: AcompanhamentoUpdate,
) -> Acompanhamento:
    """Atualiza parcialmente um registro de acompanhamento temporal (movendo anexos se a data mudar)."""
    projeto = _ensure_project_exists(db, projeto_id)
    item = db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(
            Acompanhamento.id == item_id,
            Acompanhamento.projeto_id == projeto_id,
        )
    ).first()
    if item is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Registro de acompanhamento não encontrado.",
        )

    fields = payload.model_fields_set
    date_changed = "data" in fields and item.data != payload.data
    if "data" in fields:
        item.data = payload.data
    if "descricao" in fields and payload.descricao is not None:
        item.descricao = payload.descricao
    if "justificativa" in fields and payload.justificativa is not None:
        item.justificativa = payload.justificativa
    if "anexos" in fields and payload.anexos is not None:
        item.anexos = payload.anexos

    # Mantém a pasta de anexos sincronizada com a nova data do registro.
    if date_changed and item.anexos_lista:
        folder = _ensure_project_folder_assigned(db, projeto)
        new_subfolder = f"acompanhamentos/{build_acompanhamento_folder_name(item.data)}"
        for anexo in item.anexos_lista:
            anexo.caminho = move_stored_file(anexo.caminho, folder, new_subfolder)

    db.commit()
    return db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(Acompanhamento.id == item.id)
    ).one()


def delete_acompanhamento(db: Session, projeto_id: str, item_id: str) -> None:
    """Remove um registro de acompanhamento temporal, seus arquivos e a pasta da data no servidor."""
    projeto = _ensure_project_exists(db, projeto_id)
    item = db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(
            Acompanhamento.id == item_id,
            Acompanhamento.projeto_id == projeto_id,
        )
    ).first()
    if item is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Registro de acompanhamento não encontrado.",
        )

    subfolders_to_clean = {build_acompanhamento_folder_name(item.data)}
    for anexo in item.anexos_lista:
        # Coleta também a subpasta real onde o arquivo estava (cobre pastas legadas por ID).
        parts = PurePosixPath(anexo.caminho.replace("\\", "/")).parts
        if len(parts) >= 3 and parts[1] == "acompanhamentos":
            subfolders_to_clean.add(parts[2])
        delete_stored_file(anexo.caminho)

    db.delete(item)
    db.commit()

    if projeto.pasta:
        for subfolder_name in subfolders_to_clean:
            remove_acompanhamento_folder_if_empty(projeto.pasta, subfolder_name)


def upload_project_relatorio(
    db: Session,
    projeto_id: str,
    upload: UploadFile,
) -> Projeto:
    """Salva o relatório final na pasta do projeto e grava apenas o caminho relativo no banco."""
    projeto = get_project_or_404(db, projeto_id)
    folder = _ensure_project_folder_assigned(db, projeto)
    previous_path = projeto.relatorio

    _, relative_path, _ = save_uploaded_file(folder, "relatorio-final", upload)
    projeto.relatorio = relative_path
    db.commit()

    # Remove o arquivo anterior após o commit para evitar perda caso a gravação no banco falhe.
    if previous_path and previous_path != relative_path:
        delete_stored_file(previous_path)

    return get_project_or_404(db, projeto.id)


def get_project_relatorio_file(db: Session, projeto_id: str) -> tuple[Path, str]:
    """Localiza o arquivo físico do relatório final para download autenticado."""
    projeto = _ensure_project_exists(db, projeto_id)
    if not projeto.relatorio:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Este projeto ainda não possui relatório final anexado.",
        )
    file_path = resolve_stored_file(projeto.relatorio)
    filename = PurePosixPath(projeto.relatorio.replace("\\", "/")).name
    return file_path, filename


def delete_project_relatorio(db: Session, projeto_id: str) -> Projeto:
    """Remove o arquivo de relatório final do servidor e limpa o caminho no banco."""
    projeto = get_project_or_404(db, projeto_id)
    previous_path = projeto.relatorio
    projeto.relatorio = None
    db.commit()
    delete_stored_file(previous_path)
    return get_project_or_404(db, projeto.id)


def upload_acompanhamento_anexos(
    db: Session,
    projeto_id: str,
    item_id: str,
    uploads: list[UploadFile],
) -> Acompanhamento:
    """Salva um ou mais anexos na pasta de acompanhamentos do projeto e registra os caminhos no banco."""
    projeto = _ensure_project_exists(db, projeto_id)
    item = db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(
            Acompanhamento.id == item_id,
            Acompanhamento.projeto_id == projeto_id,
        )
    ).first()
    if item is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Registro de acompanhamento não encontrado.",
        )

    folder = _ensure_project_folder_assigned(db, projeto)
    date_folder = build_acompanhamento_folder_name(item.data)
    for upload in uploads:
        original_name, relative_path, size = save_uploaded_file(
            folder,
            f"acompanhamentos/{date_folder}",
            upload,
        )
        item.anexos_lista.append(
            AcompanhamentoAnexo(
                id=_new_id(),
                nome_original=original_name,
                caminho=relative_path,
                tamanho=size,
            )
        )

    item.anexos = len(item.anexos_lista)
    db.commit()
    db.refresh(item)
    return db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(Acompanhamento.id == item.id)
    ).one()


def get_acompanhamento_anexo_file(
    db: Session,
    projeto_id: str,
    item_id: str,
    anexo_id: str,
) -> tuple[Path, str]:
    """Localiza o arquivo físico de um anexo de acompanhamento para download."""
    anexo = db.scalars(
        select(AcompanhamentoAnexo)
        .join(Acompanhamento, Acompanhamento.id == AcompanhamentoAnexo.acompanhamento_id)
        .where(
            AcompanhamentoAnexo.id == anexo_id,
            Acompanhamento.id == item_id,
            Acompanhamento.projeto_id == projeto_id,
        )
    ).first()
    if anexo is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Anexo não encontrado.",
        )
    return resolve_stored_file(anexo.caminho), anexo.nome_original


def delete_acompanhamento_anexo(
    db: Session,
    projeto_id: str,
    item_id: str,
    anexo_id: str,
) -> Acompanhamento:
    """Remove um anexo específico do disco e atualiza o contador do acompanhamento."""
    item = db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(
            Acompanhamento.id == item_id,
            Acompanhamento.projeto_id == projeto_id,
        )
    ).first()
    if item is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Registro de acompanhamento não encontrado.",
        )

    target = next((a for a in item.anexos_lista if a.id == anexo_id), None)
    if target is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Anexo não encontrado.",
        )

    file_path = target.caminho
    db.delete(target)
    db.flush()
    remaining = (
        db.scalar(
            select(func.count())
            .select_from(AcompanhamentoAnexo)
            .where(AcompanhamentoAnexo.acompanhamento_id == item.id)
        )
        or 0
    )
    item.anexos = remaining
    db.commit()
    delete_stored_file(file_path)

    return db.scalars(
        select(Acompanhamento)
        .options(selectinload(Acompanhamento.anexos_lista))
        .where(Acompanhamento.id == item.id)
    ).one()


def create_custo(db: Session, projeto_id: str, payload: CustoCreate) -> Custo:
    """Adiciona um item de custo/investimento ao projeto."""
    _ensure_project_exists(db, projeto_id)
    max_order = db.scalar(
        select(func.coalesce(func.max(Custo.ordem), -1)).where(Custo.projeto_id == projeto_id)
    )
    next_order = int(max_order if max_order is not None else -1) + 1

    item_date = payload.data if "data" in payload.model_fields_set else date.today()
    item = Custo(
        id=_new_id(),
        projeto_id=projeto_id,
        data=item_date,
        material=payload.material,
        tipo=payload.tipo,
        valor=payload.valor if "valor" in payload.model_fields_set else Decimal("0.00"),
        ordem=next_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_custo(db: Session, projeto_id: str, item_id: str, payload: CustoUpdate) -> Custo:
    """Atualiza parcialmente um custo/investimento."""
    item = db.scalars(
        select(Custo).where(Custo.id == item_id, Custo.projeto_id == projeto_id)
    ).first()
    if item is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Custo não encontrado.",
        )

    fields = payload.model_fields_set
    if "data" in fields:
        item.data = payload.data
    if "material" in fields and payload.material is not None:
        item.material = payload.material
    if "tipo" in fields and payload.tipo is not None:
        item.tipo = payload.tipo
    if "valor" in fields and payload.valor is not None:
        item.valor = payload.valor

    db.commit()
    db.refresh(item)
    return item


def delete_custo(db: Session, projeto_id: str, item_id: str) -> None:
    """Remove um item de custo/investimento."""
    item = db.scalars(
        select(Custo).where(Custo.id == item_id, Custo.projeto_id == projeto_id)
    ).first()
    if item is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Custo não encontrado.",
        )
    db.delete(item)
    db.commit()
