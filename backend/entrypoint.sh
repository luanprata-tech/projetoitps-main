#!/bin/sh
set -e

# Aplica migrations pendentes antes de iniciar o servidor HTTP para garantir schema atualizado.
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
