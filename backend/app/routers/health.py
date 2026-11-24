"""Endpoint de verificação de saúde da API e conectividade com o PostgreSQL."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(tags=["Saúde"])


@router.get("/health")
def healthcheck(db: Session = Depends(get_db)) -> dict[str, str]:
    """Confirma que a aplicação e o banco respondem antes de liberar tráfego do container."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível.",
        ) from exc
    return {"status": "ok", "database": "ok"}
