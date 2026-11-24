"""Configurações centralizadas carregadas a partir de variáveis de ambiente."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Define parâmetros de banco de dados, CORS, autenticação JWT e seed automático."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://projetos:projetos@db:5432/projetositps"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    auto_seed: bool = True

    # Parâmetros de assinatura e expiração do token JWT (padrão: 60 minutos / 1 hora).
    jwt_secret_key: str = "projetositps-chave-dev-altere-em-producao-2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Credenciais do administrador inicial criado apenas quando a tabela de usuários estiver vazia.
    default_admin_name: str = "Administrador"
    default_admin_username: str = "admin"
    default_admin_password: str = "Admin@123"

    # Diretório base onde as pastas dos projetos e anexos são gravados no servidor/container.
    storage_base_dir: str = "/storage"
    # Prefixo de rede (UNC) usado como referência do caminho compartilhado no servidor.
    storage_network_path: str = r"\\172.23.6.7\geprocon\ProjetosITPS"

    @property
    def cors_origins_list(self) -> list[str]:
        """Converte a lista separada por vírgulas em origens válidas para o middleware CORS."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
