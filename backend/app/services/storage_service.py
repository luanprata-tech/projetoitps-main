"""Serviço de armazenamento em sistema de arquivos para pastas de projetos e anexos."""

from pathlib import Path
import re
import unicodedata
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

# Limite de 50 MB por arquivo para evitar consumo excessivo de memória/disco por upload.
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024


def get_storage_root() -> Path:
    """Retorna o diretório raiz configurado para armazenamento, criando-o se necessário."""
    root = Path(settings.storage_base_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _slugify(value: str, max_length: int = 60) -> str:
    """Remove acentos e caracteres inválidos para gerar nomes de pastas compatíveis com Windows/Linux."""
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return (cleaned[:max_length].rstrip("-")) or "projeto"


def build_project_folder_name(titulo: str, projeto_id: str) -> str:
    """Combina o título sanitizado com o ID do projeto para garantir uma pasta legível e única."""
    return f"{_slugify(titulo)}-{projeto_id}"


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


def format_network_path(relative_path: str | None) -> str | None:
    """Formata o caminho completo na pasta de rede compartilhada (ex.: \\\\172.23.6.7\\geprocon\\ProjetosITPS\\...)."""
    if not relative_path:
        return None
    prefix = settings.storage_network_path.rstrip("\\/")
    windows_rel = relative_path.replace("/", "\\").lstrip("\\")
    return f"{prefix}\\{windows_rel}"
