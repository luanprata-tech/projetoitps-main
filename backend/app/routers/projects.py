"""Rotas REST para projetos, metas, acompanhamentos temporais e custos."""

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_editor
from app.schemas.project import (
    AcompanhamentoCreate,
    AcompanhamentoOut,
    AcompanhamentoUpdate,
    CustoCreate,
    CustoOut,
    CustoUpdate,
    MetaCreate,
    MetaOut,
    MetaUpdate,
    ProjetoOut,
    ProjetoOverviewIn,
)
from app.services import project_service

# Leitura e download ficam disponíveis no modo de visualização pública; escrita exige editor/admin.
router = APIRouter(
    prefix="/api/projetos",
    tags=["Projetos"],
)


@router.get("", response_model=list[ProjetoOut])
def list_projects(db: Session = Depends(get_db)):
    """Lista todos os projetos com seus respectivos planos de trabalho."""
    return project_service.list_projects(db)


@router.post(
    "",
    response_model=ProjetoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_project(payload: ProjetoOverviewIn, db: Session = Depends(get_db)):
    """Cria um novo projeto a partir do formulário de visão geral."""
    return project_service.create_project(db, payload)


@router.get("/{projeto_id}", response_model=ProjetoOut)
def get_project(projeto_id: str, db: Session = Depends(get_db)):
    """Retorna os detalhes completos de um projeto específico."""
    return project_service.get_project_or_404(db, projeto_id)


@router.put(
    "/{projeto_id}",
    response_model=ProjetoOut,
    dependencies=[Depends(require_editor)],
)
def update_project_overview(
    projeto_id: str,
    payload: ProjetoOverviewIn,
    db: Session = Depends(get_db),
):
    """Atualiza apenas dados de visão geral sem sobrescrever metas, acompanhamentos e custos."""
    return project_service.update_project_overview(db, projeto_id, payload)


@router.delete(
    "/{projeto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_editor)],
)
def delete_project(
    projeto_id: str,
    db: Session = Depends(get_db),
):
    """Remove o projeto do banco de dados mantendo a pasta e os anexos na pasta compartilhada."""
    project_service.delete_project(db, projeto_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{projeto_id}/concluir",
    response_model=ProjetoOut,
    dependencies=[Depends(require_editor)],
)
def conclude_project(
    projeto_id: str,
    db: Session = Depends(get_db),
):
    """Marca o projeto como concluído e move sua pasta física para 'projetos finalizados'."""
    return project_service.conclude_project(db, projeto_id)


@router.post(
    "/{projeto_id}/relatorio",
    response_model=ProjetoOut,
    dependencies=[Depends(require_editor)],
)
def upload_relatorio(
    projeto_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Recebe o arquivo do relatório final, grava na pasta do projeto e salva apenas o caminho no banco."""
    return project_service.upload_project_relatorio(db, projeto_id, file)


@router.get("/{projeto_id}/relatorio/download")
def download_relatorio(
    projeto_id: str,
    db: Session = Depends(get_db),
):
    """Faz o download do relatório final armazenado na pasta do projeto."""
    file_path, filename = project_service.get_project_relatorio_file(db, projeto_id)
    return FileResponse(path=file_path, filename=filename)


@router.delete(
    "/{projeto_id}/relatorio",
    response_model=ProjetoOut,
    dependencies=[Depends(require_editor)],
)
def delete_relatorio(
    projeto_id: str,
    db: Session = Depends(get_db),
):
    """Remove o relatório final do armazenamento e limpa o caminho no banco."""
    return project_service.delete_project_relatorio(db, projeto_id)


@router.post(
    "/{projeto_id}/metas",
    response_model=MetaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_meta(
    projeto_id: str,
    payload: MetaCreate,
    db: Session = Depends(get_db),
):
    """Adiciona uma nova meta ao plano de trabalho do projeto."""
    return project_service.create_meta(db, projeto_id, payload)


@router.patch(
    "/{projeto_id}/metas/{meta_id}",
    response_model=MetaOut,
    dependencies=[Depends(require_editor)],
)
def update_meta(
    projeto_id: str,
    meta_id: str,
    payload: MetaUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza parcialmente uma meta (descrição, semestres, semestres ativos ou status)."""
    return project_service.update_meta(db, projeto_id, meta_id, payload)


@router.delete(
    "/{projeto_id}/metas/{meta_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_editor)],
)
def delete_meta(
    projeto_id: str,
    meta_id: str,
    db: Session = Depends(get_db),
):
    """Remove uma meta do plano de trabalho."""
    project_service.delete_meta(db, projeto_id, meta_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{projeto_id}/acompanhamentos",
    response_model=AcompanhamentoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_acompanhamento(
    projeto_id: str,
    payload: AcompanhamentoCreate,
    db: Session = Depends(get_db),
):
    """Registra um novo acompanhamento temporal no projeto."""
    return project_service.create_acompanhamento(db, projeto_id, payload)


@router.patch(
    "/{projeto_id}/acompanhamentos/{item_id}",
    response_model=AcompanhamentoOut,
    dependencies=[Depends(require_editor)],
)
def update_acompanhamento(
    projeto_id: str,
    item_id: str,
    payload: AcompanhamentoUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza parcialmente um registro de acompanhamento temporal."""
    return project_service.update_acompanhamento(db, projeto_id, item_id, payload)


@router.delete(
    "/{projeto_id}/acompanhamentos/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_editor)],
)
def delete_acompanhamento(
    projeto_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Remove um registro de acompanhamento temporal e seus anexos em disco."""
    project_service.delete_acompanhamento(db, projeto_id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{projeto_id}/acompanhamentos/{item_id}/anexos",
    response_model=AcompanhamentoOut,
    dependencies=[Depends(require_editor)],
)
def upload_acompanhamento_anexos(
    projeto_id: str,
    item_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Salva arquivos anexos na pasta de acompanhamentos do projeto e grava os caminhos no banco."""
    return project_service.upload_acompanhamento_anexos(db, projeto_id, item_id, files)


@router.get("/{projeto_id}/acompanhamentos/{item_id}/anexos/{anexo_id}/download")
def download_acompanhamento_anexo(
    projeto_id: str,
    item_id: str,
    anexo_id: str,
    db: Session = Depends(get_db),
):
    """Faz o download de um anexo específico do acompanhamento temporal."""
    file_path, filename = project_service.get_acompanhamento_anexo_file(
        db,
        projeto_id,
        item_id,
        anexo_id,
    )
    return FileResponse(path=file_path, filename=filename)


@router.delete(
    "/{projeto_id}/acompanhamentos/{item_id}/anexos/{anexo_id}",
    response_model=AcompanhamentoOut,
    dependencies=[Depends(require_editor)],
)
def delete_acompanhamento_anexo(
    projeto_id: str,
    item_id: str,
    anexo_id: str,
    db: Session = Depends(get_db),
):
    """Remove um anexo do disco e atualiza o registro de acompanhamento."""
    return project_service.delete_acompanhamento_anexo(db, projeto_id, item_id, anexo_id)


@router.post(
    "/{projeto_id}/custos",
    response_model=CustoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_custo(
    projeto_id: str,
    payload: CustoCreate,
    db: Session = Depends(get_db),
):
    """Registra um novo item de custo ou investimento no projeto."""
    return project_service.create_custo(db, projeto_id, payload)


@router.patch(
    "/{projeto_id}/custos/{item_id}",
    response_model=CustoOut,
    dependencies=[Depends(require_editor)],
)
def update_custo(
    projeto_id: str,
    item_id: str,
    payload: CustoUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza parcialmente um item de custo/investimento."""
    return project_service.update_custo(db, projeto_id, item_id, payload)


@router.delete(
    "/{projeto_id}/custos/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_editor)],
)
def delete_custo(
    projeto_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Remove um item de custo/investimento."""
    project_service.delete_custo(db, projeto_id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
