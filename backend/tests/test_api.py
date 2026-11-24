"""Testes automatizados da API FastAPI, autenticação JWT e regras de negócio do ProjetosITPS."""

from collections.abc import Generator
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import jwt
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.services.seed_service import seed_initial_data


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Generator[TestClient, None, None]:
    """Cria banco SQLite e pasta de storage temporária isolados para cada teste."""
    monkeypatch.setattr(settings, "storage_base_dir", str(tmp_path / "storage"))
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    with TestingSessionLocal() as db:
        seed_initial_data(db)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def _login_headers(client: TestClient, username: str, password: str) -> dict[str, str]:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_auth_protection_and_jwt_expiration(client: TestClient) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "database": "ok"}

    # Rotas protegidas devem bloquear acesso sem token.
    assert client.get("/api/projetos").status_code == 401
    assert client.get("/api/statuses").status_code == 401
    assert client.get("/api/users").status_code == 401
    assert client.get("/api/auth/me").status_code == 401

    # Login com credenciais do administrador inicial retorna token válido por 1 hora (3600s).
    login_resp = client.post(
        "/api/auth/login",
        json={
            "username": settings.default_admin_username,
            "password": settings.default_admin_password,
        },
    )
    assert login_resp.status_code == 200
    body = login_resp.json()
    assert body["expires_in"] == 3600
    assert body["user"]["role"] == "admin"

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    statuses = client.get("/api/statuses", headers=headers)
    assert statuses.status_code == 200
    assert [s["label"] for s in statuses.json()] == ["Planejado", "Em Andamento", "Concluído"]

    # O sistema inicia sem projetos mockados.
    projetos = client.get("/api/projetos", headers=headers)
    assert projetos.status_code == 200
    assert projetos.json() == []

    # Token expirado deve retornar 401 imediatamente.
    expired_token = jwt.encode(
        {
            "sub": "admin-default",
            "role": "admin",
            "exp": int((datetime.now(timezone.utc) - timedelta(seconds=10)).timestamp()),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    expired_resp = client.get(
        "/api/projetos",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert expired_resp.status_code == 401


def test_admin_user_management_and_role_permissions(client: TestClient) -> None:
    admin_headers = _login_headers(
        client,
        settings.default_admin_username,
        settings.default_admin_password,
    )

    # Admin cria um usuário comum.
    created = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "nome": "Maria Pesquisadora",
            "username": "maria",
            "password": "SenhaInicial1",
            "role": "user",
            "ativo": True,
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    # Nome de usuário duplicado (case-insensitive) deve ser rejeitado.
    dup = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "nome": "Maria 2",
            "username": "MARIA",
            "password": "SenhaInicial1",
            "role": "user",
        },
    )
    assert dup.status_code == 409

    # Usuário comum pode acessar projetos/status, mas é bloqueado em /api/users (403).
    user_headers = _login_headers(client, "maria", "SenhaInicial1")
    assert client.get("/api/projetos", headers=user_headers).status_code == 200
    assert client.get("/api/users", headers=user_headers).status_code == 403

    # Admin edita informações do usuário.
    edited = client.put(
        f"/api/users/{user_id}",
        headers=admin_headers,
        json={
            "nome": "Maria Silva",
            "username": "maria.silva",
            "role": "user",
            "ativo": True,
        },
    )
    assert edited.status_code == 200
    assert edited.json()["nome"] == "Maria Silva"
    assert edited.json()["username"] == "maria.silva"

    # Admin reseta a senha do usuário; senha antiga falha e nova funciona.
    reset_resp = client.post(
        f"/api/users/{user_id}/reset-password",
        headers=admin_headers,
        json={"new_password": "NovaSenha99"},
    )
    assert reset_resp.status_code == 200

    old_login = client.post(
        "/api/auth/login",
        json={"username": "maria.silva", "password": "SenhaInicial1"},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/auth/login",
        json={"username": "maria.silva", "password": "NovaSenha99"},
    )
    assert new_login.status_code == 200

    # Admin não pode excluir ou desativar a própria conta.
    assert client.delete("/api/users/admin-default", headers=admin_headers).status_code == 400

    # Admin pode excluir outro usuário.
    assert client.delete(f"/api/users/{user_id}", headers=admin_headers).status_code == 204


def test_update_overview_preserves_metas_acompanhamentos_and_custos(client: TestClient) -> None:
    headers = _login_headers(
        client,
        settings.default_admin_username,
        settings.default_admin_password,
    )
    created = client.post(
        "/api/projetos",
        headers=headers,
        json={
            "titulo": "Projeto Base",
            "edital": "ED-2025",
            "objetivo": "Objetivo inicial",
            "impacto": "Impacto inicial",
            "inicio": "2025-03-01",
            "fim": "2026-03-01",
            "supervisor": "Profa. Ana",
            "bolsistas": [{"modalidade": "DTI 1", "nome": "Lucas"}],
        },
    ).json()
    pid = created["id"]

    client.post(f"/api/projetos/{pid}/metas", headers=headers, json={"descricao": "Meta 1"})
    client.post(
        f"/api/projetos/{pid}/acompanhamentos",
        headers=headers,
        json={"descricao": "Reunião inicial"},
    )
    client.post(
        f"/api/projetos/{pid}/custos",
        headers=headers,
        json={"material": "Reagentes", "tipo": "Consumo", "valor": 250.5},
    )
    before = client.get(f"/api/projetos/{pid}", headers=headers).json()

    resp = client.put(
        f"/api/projetos/{pid}",
        headers=headers,
        json={
            "titulo": "Projeto Base Atualizado",
            "edital": before["edital"],
            "objetivo": "Novo objetivo atualizado",
            "impacto": before["impacto"],
            "inicio": before["inicio"],
            "fim": before["fim"],
            "supervisor": "Novo Supervisor",
            "relatorio": "relatorio-novo.pdf",
            "bolsistas": [{"modalidade": "DTR", "nome": "Ana Maria"}],
        },
    )
    assert resp.status_code == 200
    after = resp.json()

    assert after["titulo"] == "Projeto Base Atualizado"
    assert after["bolsistas"] == [{"modalidade": "DTR", "nome": "Ana Maria"}]
    assert after["metas"] == before["metas"]
    assert after["acompanhamentos"] == before["acompanhamentos"]
    assert after["custos"] == before["custos"]


def test_status_rules_unique_and_atomic_reassignment(client: TestClient) -> None:
    headers = _login_headers(
        client,
        settings.default_admin_username,
        settings.default_admin_password,
    )

    dup = client.post(
        "/api/statuses",
        headers=headers,
        json={"label": "  planejado ", "tone": "neutral"},
    )
    assert dup.status_code == 409

    created = client.post(
        "/api/statuses",
        headers=headers,
        json={"id": "pausado", "label": "Pausado", "tone": "alert"},
    )
    assert created.status_code == 201
    assert created.json()["id"] == "pausado"

    edited = client.put(
        "/api/statuses/Planejado",
        headers=headers,
        json={"label": "A iniciar", "tone": "neutral"},
    )
    assert edited.status_code == 200
    assert edited.json() == {"id": "Planejado", "label": "A iniciar", "tone": "neutral"}

    proj = client.post("/api/projetos", headers=headers, json={"titulo": "Projeto Status"}).json()
    pid = proj["id"]
    meta = client.post(
        f"/api/projetos/{pid}/metas",
        headers=headers,
        json={
            "descricao": "Meta planejada",
            "status": "Planejado",
            "semestres": [True, False, False, False],
            "semestresAtivos": [True, True, False, False],
        },
    ).json()

    assert client.delete("/api/statuses/Planejado", headers=headers).status_code == 400

    deleted = client.delete(
        "/api/statuses/Planejado?substitute_status_id=Em%20Andamento",
        headers=headers,
    )
    assert deleted.status_code == 200
    assert deleted.json()["reassigned_goals"] == 1

    proj_after = client.get(f"/api/projetos/{pid}", headers=headers).json()
    migrated = next(m for m in proj_after["metas"] if m["id"] == meta["id"])
    assert migrated["status"] == "Em Andamento"
    assert migrated["semestres"] == [True, False, False, False]
    assert migrated["semestresAtivos"] == [True, True, False, False]

    for st_id in ["Em Andamento", "Concluído"]:
        r = client.delete(f"/api/statuses/{st_id}?substitute_status_id=pausado", headers=headers)
        assert r.status_code == 200

    assert client.delete("/api/statuses/pausado", headers=headers).status_code == 400


def test_subresources_crud_and_decimal_precision(client: TestClient) -> None:
    headers = _login_headers(
        client,
        settings.default_admin_username,
        settings.default_admin_password,
    )
    created_proj = client.post(
        "/api/projetos",
        headers=headers,
        json={"titulo": "Projeto Novo", "edital": "ED-01"},
    ).json()
    pid = created_proj["id"]

    meta = client.post(f"/api/projetos/{pid}/metas", headers=headers, json={}).json()
    assert meta["codigo"] == "M01"
    assert meta["semestresAtivos"] == [True, True, True, True]

    patched_meta = client.patch(
        f"/api/projetos/{pid}/metas/{meta['id']}",
        headers=headers,
        json={
            "descricao": "Atividade 1",
            "semestres": [True, False, False, False],
            "semestresAtivos": [True, True, False, False],
        },
    ).json()
    assert patched_meta["descricao"] == "Atividade 1"
    assert patched_meta["semestres"] == [True, False, False, False]
    assert patched_meta["semestresAtivos"] == [True, True, False, False]

    acomp = client.post(
        f"/api/projetos/{pid}/acompanhamentos",
        headers=headers,
        json={"descricao": "Reunião", "anexos": 2},
    ).json()
    assert acomp["anexos"] == 2

    custo = client.post(
        f"/api/projetos/{pid}/custos",
        headers=headers,
        json={"material": "Vidraria", "tipo": "Consumo", "valor": 123.45},
    ).json()
    assert custo["valor"] == 123.45

    assert client.delete(f"/api/projetos/{pid}/custos/{custo['id']}", headers=headers).status_code == 204
    assert (
        client.delete(f"/api/projetos/{pid}/acompanhamentos/{acomp['id']}", headers=headers).status_code
        == 204
    )
    assert client.delete(f"/api/projetos/{pid}/metas/{meta['id']}", headers=headers).status_code == 204


def test_project_folder_creation_and_file_upload_download(client: TestClient, tmp_path) -> None:
    headers = _login_headers(
        client,
        settings.default_admin_username,
        settings.default_admin_password,
    )
    created = client.post(
        "/api/projetos",
        headers=headers,
        json={"titulo": "Análise de Águas Amazônicas"},
    ).json()
    pid = created["id"]
    pasta = created["pasta"]
    assert pasta.startswith("analise-de-aguas-amazonicas-")

    # Verifica que a pasta do projeto foi criada automaticamente no diretório configurado.
    project_dir = tmp_path / "storage" / pasta
    assert (project_dir / "relatorio-final").is_dir()
    assert (project_dir / "acompanhamentos").is_dir()

    # Upload e download do relatório final.
    up_rel = client.post(
        f"/api/projetos/{pid}/relatorio",
        headers=headers,
        files={"file": ("relatorio_final.pdf", b"%PDF-1.4 conteudo teste", "application/pdf")},
    )
    assert up_rel.status_code == 200
    body = up_rel.json()
    assert body["relatorio"] == f"{pasta}/relatorio-final/relatorio_final.pdf"
    assert body["relatorioNome"] == "relatorio_final.pdf"
    assert body["relatorioCaminhoRede"].endswith(f"{pasta}\\relatorio-final\\relatorio_final.pdf")
    assert (project_dir / "relatorio-final" / "relatorio_final.pdf").is_file()

    dl_rel = client.get(f"/api/projetos/{pid}/relatorio/download", headers=headers)
    assert dl_rel.status_code == 200
    assert dl_rel.content == b"%PDF-1.4 conteudo teste"

    # Upload, download e remoção de anexos no acompanhamento temporal.
    acomp = client.post(
        f"/api/projetos/{pid}/acompanhamentos",
        headers=headers,
        json={"descricao": "Visita técnica"},
    ).json()
    up_anexo = client.post(
        f"/api/projetos/{pid}/acompanhamentos/{acomp['id']}/anexos",
        headers=headers,
        files=[("files", ("ata.txt", b"Ata de reuniao", "text/plain"))],
    )
    assert up_anexo.status_code == 200
    anexos_lista = up_anexo.json()["anexosLista"]
    assert len(anexos_lista) == 1
    assert up_anexo.json()["anexos"] == 1
    anexo_id = anexos_lista[0]["id"]

    dl_anexo = client.get(
        f"/api/projetos/{pid}/acompanhamentos/{acomp['id']}/anexos/{anexo_id}/download",
        headers=headers,
    )
    assert dl_anexo.status_code == 200
    assert dl_anexo.content == b"Ata de reuniao"

    del_anexo = client.delete(
        f"/api/projetos/{pid}/acompanhamentos/{acomp['id']}/anexos/{anexo_id}",
        headers=headers,
    )
    assert del_anexo.status_code == 200
    assert del_anexo.json()["anexos"] == 0

    del_rel = client.delete(f"/api/projetos/{pid}/relatorio", headers=headers)
    assert del_rel.status_code == 200
    assert del_rel.json()["relatorio"] is None
    assert not (project_dir / "relatorio-final" / "relatorio_final.pdf").exists()


def test_three_roles_rbac_admin_editor_and_readonly_user(client: TestClient) -> None:
    admin_headers = _login_headers(
        client,
        settings.default_admin_username,
        settings.default_admin_password,
    )

    # Admin cria um editor e um usuário somente leitura.
    assert (
        client.post(
            "/api/users",
            headers=admin_headers,
            json={
                "nome": "Carlos Editor",
                "username": "carlos.editor",
                "password": "Editor123",
                "role": "editor",
            },
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/users",
            headers=admin_headers,
            json={
                "nome": "Paula Leitora",
                "username": "paula.user",
                "password": "Reader123",
                "role": "user",
            },
        ).status_code
        == 201
    )

    editor_headers = _login_headers(client, "carlos.editor", "Editor123")
    user_headers = _login_headers(client, "paula.user", "Reader123")

    # Editor cria projeto e envia relatório, mas não pode gerenciar usuários.
    assert client.get("/api/users", headers=editor_headers).status_code == 403
    proj_resp = client.post(
        "/api/projetos",
        headers=editor_headers,
        json={"titulo": "Projeto do Editor"},
    )
    assert proj_resp.status_code == 201
    pid = proj_resp.json()["id"]

    up_rel = client.post(
        f"/api/projetos/{pid}/relatorio",
        headers=editor_headers,
        files={"file": ("relatorio.pdf", b"PDF-EDITOR", "application/pdf")},
    )
    assert up_rel.status_code == 200

    # Usuário comum pode visualizar e baixar anexos, mas é bloqueado em qualquer escrita (403).
    assert client.get("/api/projetos", headers=user_headers).status_code == 200
    assert client.get(f"/api/projetos/{pid}", headers=user_headers).status_code == 200
    assert client.get("/api/statuses", headers=user_headers).status_code == 200
    dl = client.get(f"/api/projetos/{pid}/relatorio/download", headers=user_headers)
    assert dl.status_code == 200
    assert dl.content == b"PDF-EDITOR"

    assert (
        client.post("/api/projetos", headers=user_headers, json={"titulo": "Bloqueado"}).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/projetos/{pid}",
            headers=user_headers,
            json={"titulo": "Alterado"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/projetos/{pid}/relatorio",
            headers=user_headers,
            files={"file": ("x.pdf", b"x", "application/pdf")},
        ).status_code
        == 403
    )
    assert client.delete(f"/api/projetos/{pid}/relatorio", headers=user_headers).status_code == 403
    assert client.post(f"/api/projetos/{pid}/metas", headers=user_headers, json={}).status_code == 403
    assert (
        client.post(
            "/api/statuses",
            headers=user_headers,
            json={"label": "Novo", "tone": "planned"},
        ).status_code
        == 403
    )
    assert client.get("/api/users", headers=user_headers).status_code == 403
