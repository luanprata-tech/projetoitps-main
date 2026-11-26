# Manual de Implantação — ProjetosITPS

Este manual descreve o passo a passo completo para implantar, conectar ao servidor de arquivos Windows e manter o sistema **ProjetosITPS** em um servidor Linux (Ubuntu/Debian) utilizando **Docker** e **Coolify** (ou **Docker Compose** diretamente).

---

## 1. Visão Geral da Arquitetura

O sistema é composto por 3 containers integrados:

| Serviço | Tecnologia | Porta Interna | Exemplo em Produção | Função |
| --- | --- | --- | --- | --- |
| **frontend** | React 19 + TanStack Start (Node 22 / Nitro) | `3000` | `3010` | Interface web (painel autenticado e modo `/exibicao`) |
| **backend** | Python 3.12 + FastAPI + SQLAlchemy + Alembic | `8000` | `8010` | API REST, autenticação JWT, regras de negócio e upload/download |
| **db** | PostgreSQL 16 (`postgres:16-alpine`) | `5432` | *(rede interna)* | Banco de dados relacional persistente |

Além disso, o container **backend** grava e lê arquivos (relatórios finais e anexos de acompanhamento) no diretório interno `/storage`, que é vinculado à pasta compartilhada do servidor Windows (`\\172.23.6.7\geprocon\ProjetosITPS`) previamente montada no Linux em `/mnt/geprocon/ProjetosITPS`.

---

## 2. Pré-requisitos no Servidor Linux

- Servidor Ubuntu/Debian com acesso SSH (`sudo`).
- **Docker** e **Docker Compose** (ou **Coolify** já instalado).
- **Git** instalado.
- Conectividade de rede do servidor Linux até o servidor de arquivos Windows na porta **TCP 445** (SMB/CIFS).
- Credenciais de um usuário de rede/Windows com permissão de **leitura e escrita** na pasta compartilhada `\\172.23.6.7\geprocon\ProjetosITPS`.

---

## 3. Conexão Manual do Linux com a Pasta Compartilhada do Windows (SMB/CIFS)

Antes de subir os containers, conecte o servidor Linux à pasta compartilhada do Windows diretamente pelo terminal. Depois que a pasta estiver montada no Linux, o Docker apenas aponta o volume para ela, tornando o processo simples e estável.

### 3.1. Testar conectividade com o servidor Windows (porta 445)

No terminal do servidor Linux, confirme que a porta `445` (SMB) está acessível:

```bash
nc -zv 172.23.6.7 445
```

> Resultado esperado: `Connection to 172.23.6.7 445 port [tcp/microsoft-ds] succeeded!`  
> Se falhar ou der timeout, verifique firewall/rede entre a VM Linux e o servidor Windows.

### 3.2. Instalar o cliente SMB/CIFS no Linux

```bash
sudo apt update
sudo apt install -y cifs-utils
```

Teste se o módulo `cifs` do kernel carrega corretamente:

```bash
sudo modprobe cifs
```

> **Atenção (caso apareça `Exec format error` ou `Module cifs not found`):**  
> Em algumas VMs Ubuntu, o pacote de módulos extras do kernel precisa ser instalado e a VM reiniciada:
> ```bash
> sudo apt install -y linux-modules-extra-$(uname -r)
> sudo reboot
> ```
> Após reiniciar, repita `sudo modprobe cifs` (não deve retornar erro).

### 3.3. Criar o ponto de montagem local no Linux

```bash
sudo mkdir -p /mnt/geprocon/ProjetosITPS
```

### 3.4. Criar o arquivo de credenciais protegido

Crie o arquivo `/etc/smb-credentials` para evitar expor usuário e senha nos comandos ou no `/etc/fstab`:

```bash
sudo nano /etc/smb-credentials
```

Preencha com o usuário e senha que têm permissão na pasta compartilhada:

```ini
username=SEU_USUARIO_WINDOWS
password=SUA_SENHA_WINDOWS
```

> Se o servidor Windows exigir domínio Active Directory, adicione também a linha:
> ```ini
> domain=SEU_DOMINIO
> ```

Salve (`Ctrl + O`, `Enter`, `Ctrl + X`) e restrinja a leitura apenas ao `root`:

```bash
sudo chmod 600 /etc/smb-credentials
```

### 3.5. Montar a pasta manualmente pelo comando do Linux

Execute o comando de montagem manual:

```bash
sudo mount -t cifs //172.23.6.7/geprocon/ProjetosITPS /mnt/geprocon/ProjetosITPS \
  -o credentials=/etc/smb-credentials,vers=3.0,file_mode=0777,dir_mode=0777
```

> **Dica:** caso o servidor Windows utilize outra versão do protocolo SMB, tente ajustar `vers=3.0` para `vers=3.1.1` ou `vers=2.1`.

### 3.6. Validar leitura e escrita na pasta montada

```bash
ls -la /mnt/geprocon/ProjetosITPS
touch /mnt/geprocon/ProjetosITPS/.teste_escrita && rm /mnt/geprocon/ProjetosITPS/.teste_escrita
```

Se ambos os comandos executarem sem erro, o Linux está conectado com leitura e escrita à pasta do Windows.

### 3.7. Tornar a montagem permanente (automática ao reiniciar a VM)

Para não precisar rodar o comando `mount` manualmente toda vez que o servidor Linux reiniciar, adicione a entrada ao `/etc/fstab`:

```bash
sudo nano /etc/fstab
```

Adicione esta linha ao final do arquivo:

```text
//172.23.6.7/geprocon/ProjetosITPS  /mnt/geprocon/ProjetosITPS  cifs  credentials=/etc/smb-credentials,vers=3.0,file_mode=0777,dir_mode=0777,_netdev,nofail  0  0
```

> As opções `_netdev` e `nofail` garantem que o Linux aguarde a rede subir antes de montar e não trave o boot caso o servidor de arquivos esteja indisponível.

Teste a configuração do `fstab` desmontando e remontando:

```bash
sudo umount /mnt/geprocon/ProjetosITPS
sudo mount -a
mount | grep geprocon
```

### 3.8. Comandos úteis de manutenção da montagem

- **Verificar se a pasta está montada:**
  ```bash
  df -h /mnt/geprocon/ProjetosITPS
  ```
- **Remontar manualmente após queda momentânea da rede:**
  ```bash
  sudo umount -l /mnt/geprocon/ProjetosITPS
  sudo mount -a
  ```

---

## 4. Variáveis de Ambiente

Use o arquivo `.env.example` como referência. **Nunca versione o arquivo `.env` no Git** (ele já está listado no `.gitignore`).

| Variável | Exemplo (Produção) | Onde é usada | Observação |
| --- | --- | --- | --- |
| `POSTGRES_USER` | `projetos` | `db` | Usuário do PostgreSQL |
| `POSTGRES_PASSWORD` | `SENHA_FORTE_BANCO` | `db` | Senha do PostgreSQL |
| `POSTGRES_DB` | `projetositps` | `db` | Nome do banco |
| `DATABASE_URL` | `postgresql+psycopg://projetos:SENHA_FORTE_BANCO@db:5432/projetositps` | `backend` | Deve bater com `POSTGRES_*` |
| `JWT_SECRET_KEY` | `chave-secreta-longa-e-aleatoria` | `backend` | Altere sempre em produção |
| `JWT_EXPIRE_MINUTES` | `60` | `backend` | Duração da sessão (60 min = 1 hora) |
| `AUTO_SEED` | `true` | `backend` | Cria status padrão e admin inicial se o banco estiver vazio |
| `DEFAULT_ADMIN_NAME` | `Administrador ITPS` | `backend` | Nome exibido do admin inicial |
| `DEFAULT_ADMIN_USERNAME` | `admin` | `backend` | Login do admin inicial |
| `DEFAULT_ADMIN_PASSWORD` | `SENHA_ADMIN_FORTE` | `backend` | Senha inicial (troque após o primeiro acesso) |
| `CORS_ORIGINS` | `http://172.23.6.206:3010` | `backend` | Origem exata do frontend no navegador (várias separadas por vírgula) |
| `VITE_API_URL` | `http://172.23.6.206:8010` | `frontend` (**Buildtime**) | URL da API acessível pelo navegador dos usuários |
| `STORAGE_BASE_DIR` | `/storage` | `backend` | Caminho interno do volume dentro do container |
| `STORAGE_NETWORK_PATH` | `\\172.23.6.7\geprocon\ProjetosITPS` | `backend` | Prefixo exibido nos caminhos de rede da interface |

> **Ponto crítico sobre `VITE_API_URL`:**  
> O Vite incorpora `VITE_API_URL` no código JavaScript **durante o build**.
> - Sempre use o **IP ou domínio do servidor** (ex.: `http://172.23.6.206:8010`), e **nunca** `http://localhost:8010` (senão o navegador dos outros computadores tentará acessar o próprio `localhost` deles).
> - Sempre que alterar `VITE_API_URL`, é obrigatório reconstruir a imagem do frontend (**Force Rebuild** no Coolify ou `docker compose build --no-cache frontend`).

---

## 5. Implantação da Aplicação

### Opção A — Implantação via Coolify (Produção)

1. Crie um novo recurso no Coolify conectado ao repositório Git (`Docker Compose`).
2. Na aba **Environment Variables**, cadastre todas as variáveis da Seção 4:
   - Marque `VITE_API_URL` como **Buildtime** (ou *Available at Buildtime*).
   - Configure `CORS_ORIGINS` com o endereço exato do frontend (ex.: `http://172.23.6.206:3010`).
3. No **Docker Compose** do serviço no Coolify:
   - Mapeie a pasta montada no Linux diretamente para `/storage` no container `backend` (bind mount):
     ```yaml
     services:
       backend:
         volumes:
           - /mnt/geprocon/ProjetosITPS:/storage
         ports:
           - "8010:8000"
       frontend:
         ports:
           - "3010:3000"
     ```
   - Como a pasta já foi montada no Linux na Etapa 3, não é necessário declarar o bloco `driver_opts` CIFS no volume do Compose.
4. Clique em **Deploy** (ou **Force Rebuild** após mudar `VITE_API_URL`).

### Opção B — Implantação via Docker Compose direto na VM

1. Clone o repositório e crie o `.env`:
   ```bash
   git clone https://github.com/luanprata-tech/projetoitps-main.git
   cd projetoitps-main
   cp .env.example .env
   nano .env
   ```
2. Ajuste no `docker-compose.yml` (ou em um `docker-compose.override.yml`) o volume do `backend` para apontar para `/mnt/geprocon/ProjetosITPS:/storage` e as portas desejadas (ex.: `8010:8000` e `3010:3000`).
3. Suba os containers:
   ```bash
   docker compose up -d --build
   ```
4. Verifique se os 3 containers estão saudáveis (`Up` / `healthy`):
   ```bash
   docker ps
   ```

---

## 6. Migrations, Seed Inicial e Estrutura de Pastas

Ao iniciar o container **backend**, o script `entrypoint.sh` executa automaticamente:

1. **`alembic upgrade head`** — cria/atualiza todas as tabelas e colunas no PostgreSQL sem intervenção manual.
2. **Seed inicial (`AUTO_SEED=true`)** — somente se as tabelas estiverem vazias, cria:
   - Os 3 status padrão de metas: `Planejado`, `Em Andamento`, `Concluído`.
   - O usuário administrador definido em `DEFAULT_ADMIN_*`.
   - *(Nenhum projeto fictício é criado automaticamente.)*
3. **Estrutura automática na pasta compartilhada (`\\172.23.6.7\geprocon\ProjetosITPS`):**
   - `projetos finalizados/` — criada automaticamente na inicialização da API; projetos marcados como concluídos têm sua pasta inteira movida para dentro dela.
   - `<nome-do-projeto>-<AAAA-MM-DD>/` — criada ao cadastrar cada projeto (acrescenta `-<id>` apenas se já existir pasta com o mesmo nome e data):
     - `relatorio-final/` — relatório final do projeto.
     - `acompanhamentos/<AAAA-MM-DD>/` — anexos agrupados pela data de cada registro de acompanhamento.

---

## 7. Verificação Pós-Implantação

Execute este checklist logo após subir a aplicação:

1. **Saúde da API:**
   ```bash
   curl http://172.23.6.206:8010/health
   ```
   Deve retornar: `{"status":"ok","database":"ok"}`.
2. **Tela de Login (`http://172.23.6.206:3010/`):**
   - Ao abrir sem sessão ativa, redireciona para `/login`.
   - Faça login com o administrador inicial e crie os usuários da equipe na aba **Usuários** (`Administrador`, `Editor` ou `Usuário` somente leitura).
3. **Modo de Exibição Pública (`http://172.23.6.206:3010/exibicao`):**
   - Abra em uma janela anônima (sem login).
   - Confirme que exibe **Visão Geral** e **Plano de Trabalho** em modo somente leitura, permitindo visualizar projetos e baixar anexos sem exibir botões de edição.
4. **Teste completo de pasta compartilhada:**
   - Crie um projeto de teste e confirme no Windows (`\\172.23.6.7\geprocon\ProjetosITPS`) que a pasta `<nome>-<AAAA-MM-DD>` foi criada.
   - Envie um relatório final e um anexo de acompanhamento e teste o download.
   - Marque o projeto como concluído na Visão Geral e confirme que a pasta foi movida para `\\172.23.6.7\geprocon\ProjetosITPS\projetos finalizados\`.

---

## 8. Procedimento de Atualização (Deploy de Novas Versões)

1. Na máquina de desenvolvimento, envie as alterações para o GitHub:
   ```powershell
   git add .
   git commit -m "Descrição da atualização"
   git push origin main
   ```
2. No servidor:
   - **Se usa Coolify:** clique em **Redeploy** (ou **Force Rebuild** se alterou `VITE_API_URL` ou dependências).
   - **Se usa Docker Compose manual:**
     ```bash
     cd projetoitps-main
     git pull origin main
     docker compose up -d --build
     ```
3. Eventuais novas migrações do banco (`backend/alembic/versions/`) são aplicadas automaticamente na subida do `backend`.

---

## 9. Solução de Problemas Comuns

| Sintoma | Causa Provável | Solução |
| --- | --- | --- |
| *"Não foi possível conectar ao servidor da API"* / `ERR_CONNECTION_REFUSED` no login | `VITE_API_URL` ainda está como `localhost` ou o frontend não foi reconstruído após alterar a variável | Ajuste `VITE_API_URL=http://<IP_DA_VM>:8010` (como **Buildtime** no Coolify) e execute **Force Rebuild** |
| Erro de **CORS** no console do navegador | Origem do frontend não está listada em `CORS_ORIGINS` | Adicione exatamente `http://<IP_DA_VM>:3010` em `CORS_ORIGINS` no backend e reinicie o container |
| `modprobe cifs` retorna `Exec format error` | Módulos extras do kernel não instalados ou kernel atualizado sem reinício | Rode `sudo apt install -y linux-modules-extra-$(uname -r)` e `sudo reboot` |
| `mount error(13): Permission denied` ao montar SMB | Usuário, senha ou domínio incorretos, ou falta de permissão na pasta do Windows | Confira `/etc/smb-credentials`, adicione `domain=...` se houver AD e valide permissões de Compartilhamento + Segurança (NTFS) no Windows |
| Upload funciona no container, mas arquivo não aparece no Windows | Pasta SMB não estava montada no Linux quando o container subiu | Monte a pasta no Linux (`sudo mount -a`), confirme com `mount \| grep geprocon` e reinicie o container do backend (`docker restart <container_backend>`) |
| Favicon antigo ainda aparece na aba do navegador | Cache agressivo de ícones no navegador | Pressione `Ctrl + F5` na aba do sistema |
