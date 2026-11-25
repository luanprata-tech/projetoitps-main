"""Serviço de armazenamento em sistema de arquivos para pastas de projetos e anexos."""

from datetime import date
from pathlib import Path, PurePosixPath
import re
import shutil
import unicodedata
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

# Limite de 50 MB por arquivo para evitar consumo excessivo de memória/disco por upload.
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024
# Pasta dedicada dentro da raiz compartilhada para arquivar projetos marcados como concluídos.
FINISHED_PROJECTS_DIR_NAME = "projetos finalizados"


def get_storage_root() -> Path:
    """Retorna o diretório raiz configurado para armazenamento, criando-o se necessário."""
    root = Path(settings.storage_base_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def ensure_finished_projects_root() -> Path:
    """Garante a existência da pasta 'projetos finalizados' dentro da pasta compartilhada."""
    finished_dir = get_storage_root() / FINISHED_PROJECTS_DIR_NAME
    finished_dir.mkdir(parents=True, exist_ok=True)
    return finished_dir


def _slugify(value: str, max_length: int = 60) -> str:
    """Remove acentos e caracteres inválidos para gerar nomes de pastas compatíveis com Windows/Linux."""
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return (cleaned[:max_length].rstrip("-")) or "projeto"


def build_project_folder_name(
    titulo: str,
    projeto_id: str,
    created_on: date | None = None,
    existing_folders: set[str] | None = None,
) -> str:
    """Combina título sanitizado e data (AAAA-MM-DD); inclui o ID apenas em caso de colisão."""
    folder_date = (created_on or date.today()).isoformat()
    base_name = f"{_slugify(titulo)}-{folder_date}"
    taken = {name.lower() for name in (existing_folders or set()) if name}
    root = get_storage_root()

    if base_name.lower() not in taken and not (root / base_name).exists():
        return base_name

    # Só acrescenta o ID se já existir outra pasta com o mesmo nome e data (no banco ou no disco).
    candidate = f"{base_name}-{projeto_id}"
    suffix = 2
    while candidate.lower() in taken or (root / candidate).exists():
        candidate = f"{base_name}-{projeto_id}-{suffix}"
        suffix += 1
    return candidate


def build_acompanhamento_folder_name(item_date: date | None) -> str:
    """Usa a data do registro (AAAA-MM-DD) como nome da pasta de anexos para ordenação cronológica."""
    return item_date.isoformat() if item_date is not None else "sem-data"


def ensure_project_folders(folder_name: str) -> Path:
    """Garante a existência da pasta do projeto e das subpastas de relatório final e acompanhamentos."""
    root = get_storage_root()
    project_dir = (root / folder_name).resolve()
    if not project_dir.is_relative_to(root.resolve()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Caminho de pasta inválido.",
        )
    (project_dir / "relatorio-final").mkdir(parents=True, exist_ok=True)
    (project_dir / "acompanhamentos").mkdir(parents=True, exist_ok=True)
    return project_dir


def move_project_folder_to_finished(
    current_folder: str | None,
    titulo: str,
    projeto_id: str,
    existing_folders: set[str] | None = None,
) -> str:
    """Move a pasta completa do projeto para 'projetos finalizados/<pasta>' preservando anexos."""
    root_resolved = get_storage_root().resolve()
    finished_root = ensure_finished_projects_root().resolve()
    normalized_current = (current_folder or "").replace("\\", "/").strip("/")

    # Se o projeto já está dentro de 'projetos finalizados', garante as subpastas e evita mover novamente.
    prefix = f"{FINISHED_PROJECTS_DIR_NAME}/"
    if normalized_current.lower().startswith(prefix.lower()):
        ensure_project_folders(normalized_current)
        return normalized_current

    leaf_name = (
        PurePosixPath(normalized_current).name
        if normalized_current
        else build_project_folder_name(titulo, projeto_id, existing_folders=existing_folders)
    )
    taken = {name.lower() for name in (existing_folders or set()) if name}

    candidate_leaf = leaf_name
    candidate_rel = f"{FINISHED_PROJECTS_DIR_NAME}/{candidate_leaf}"
    if candidate_rel.lower() in taken or (finished_root / candidate_leaf).exists():
        candidate_leaf = f"{leaf_name}-{projeto_id}"
        candidate_rel = f"{FINISHED_PROJECTS_DIR_NAME}/{candidate_leaf}"
        suffix = 2
        while candidate_rel.lower() in taken or (finished_root / candidate_leaf).exists():
            candidate_leaf = f"{leaf_name}-{projeto_id}-{suffix}"
            candidate_rel = f"{FINISHED_PROJECTS_DIR_NAME}/{candidate_leaf}"
            suffix += 1

    dest_dir = (finished_root / candidate_leaf).resolve()
    if not dest_dir.is_relative_to(finished_root):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Caminho de destino inválido para projeto concluído.",
        )

    source_dir = (root_resolved / normalized_current).resolve() if normalized_current else None
    if (
        source_dir is not None
        and source_dir != root_resolved
        and source_dir != finished_root
        and source_dir.is_relative_to(root_resolved)
        and source_dir.is_dir()
    ):
        shutil.move(str(source_dir), str(dest_dir))

    ensure_project_folders(candidate_rel)
    return candidate_rel


def sanitize_filename(filename: str | None) -> str:
    """Remove diretórios e caracteres proibidos em sistemas de arquivos Windows/Linux."""
    raw_name = Path(filename or "arquivo").name
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", raw_name).strip(" .")
    return cleaned[:180] or "arquivo"


def save_uploaded_file(
    folder_name: str,
    subfolder: str,
    upload: UploadFile,
) -> tuple[str, str, int]:
    """Grava o arquivo enviado na pasta do projeto e retorna (nome_original, caminho_relativo, tamanho)."""
    project_dir = ensure_project_folders(folder_name)
    target_dir = (project_dir / subfolder).resolve()
    root_resolved = get_storage_root().resolve()
    if not target_dir.is_relative_to(root_resolved):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subpasta de destino inválida.",
        )
    target_dir.mkdir(parents=True, exist_ok=True)

    original_name = sanitize_filename(upload.filename)
    stem = Path(original_name).stem or "arquivo"
    suffix = Path(original_name).suffix
    candidate = target_dir / original_name
    # Evita sobrescrever arquivos com o mesmo nome na mesma pasta de anexos.
    if candidate.exists():
        candidate = target_dir / f"{stem}_{uuid4().hex[:6]}{suffix}"

    total_bytes = 0
    try:
        with candidate.open("wb") as out_file:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="O arquivo excede o limite máximo de 50 MB.",
                    )
                out_file.write(chunk)
    except HTTPException:
        if candidate.exists():
            candidate.unlink(missing_ok=True)
        raise

    relative_path = candidate.relative_to(root_resolved).as_posix()
    return original_name, relative_path, total_bytes


def resolve_stored_file(relative_path: str) -> Path:
    """Resolve um caminho relativo salvo no banco impedindo path traversal fora da pasta base."""
    root_resolved = get_storage_root().resolve()
    target = (root_resolved / relative_path).resolve()
    if not target.is_relative_to(root_resolved):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Caminho de arquivo inválido.",
        )
    if not target.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado no armazenamento.",
        )
    return target


def delete_stored_file(relative_path: str | None) -> None:
    """Remove o arquivo físico do disco caso exista, ignorando caminhos legados sem arquivo."""
    if not relative_path:
        return
    try:
        root_resolved = get_storage_root().resolve()
        target = (root_resolved / relative_path).resolve()
        if target.is_relative_to(root_resolved) and target.is_file():
            target.unlink(missing_ok=True)
    except OSError:
        pass


def remove_acompanhamento_folder_if_empty(folder_name: str, subfolder_name: str) -> None:
    """Remove a subpasta de data dentro de acompanhamentos se não restarem arquivos de outros registros."""
    if not folder_name or not subfolder_name:
        return
    try:
        root_resolved = get_storage_root().resolve()
        acomp_root = (root_resolved / folder_name / "acompanhamentos").resolve()
        target = (acomp_root / subfolder_name).resolve()
        if (
            target != acomp_root
            and target.is_relative_to(acomp_root)
            and target.is_dir()
            and not any(target.iterdir())
        ):
            target.rmdir()
    except OSError:
        pass


def move_stored_file(relative_path: str, folder_name: str, new_subfolder: str) -> str:
    """Move um anexo para outra subpasta (ex.: ao alterar a data do registro) e retorna o novo caminho."""
    root_resolved = get_storage_root().resolve()
    source = (root_resolved / relative_path).resolve()
    if not source.is_relative_to(root_resolved) or not source.is_file():
        return relative_path

    project_dir = ensure_project_folders(folder_name)
    target_dir = (project_dir / new_subfolder).resolve()
    if not target_dir.is_relative_to(root_resolved):
        return relative_path
    target_dir.mkdir(parents=True, exist_ok=True)

    candidate = target_dir / source.name
    if candidate == source:
        return relative_path
    if candidate.exists():
        candidate = target_dir / f"{source.stem}_{uuid4().hex[:6]}{source.suffix}"

    old_parent = source.parent
    shutil.move(str(source), str(candidate))

    # Remove a pasta antiga apenas se ficou vazia e pertence ao diretório de acompanhamentos.
    try:
        if old_parent != target_dir and old_parent.is_dir() and not any(old_parent.iterdir()):
            old_parent.rmdir()
    except OSError:
        pass

    return candidate.relative_to(root_resolved).as_posix()


def format_network_path(relative_path: str | None) -> str | None:
    """Formata o caminho completo na pasta de rede compartilhada (ex.: \\\\172.23.6.7\\geprocon\\ProjetosITPS\\...)."""
    if not relative_path:
        return None
    prefix = settings.storage_network_path.rstrip("\\/")
    windows_rel = relative_path.replace("/", "\\").lstrip("\\")
    return f"{prefix}\\{windows_rel}"
