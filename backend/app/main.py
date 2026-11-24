"""Ponto de entrada da API FastAPI do sistema ProjetosITPS."""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import auth, health, projects, statuses, users
from app.services.seed_service import seed_initial_data

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Executa o seed inicial apenas quando habilitado e o banco estiver vazio."""
    if settings.auto_seed:
        db = SessionLocal()
        try:
            created = seed_initial_data(db)
            if created:
                logger.info("Seed inicial aplicado com sucesso no ProjetosITPS.")
        except Exception as exc:
            # Evita travar a inicialização caso as migrations ainda não tenham sido executadas.
            logger.warning("Não foi possível executar o seed automático na inicialização: %s", exc)
        finally:
            db.close()
    yield


app = FastAPI(
    title="ProjetosITPS API",
    description="API REST persistente para acompanhamento de projetos de pesquisa e extensão.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(statuses.router)
app.include_router(projects.router)
