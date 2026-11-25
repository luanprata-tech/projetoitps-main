import type { StatusOption } from "./status-options";
import type { Acompanhamento, Custo, Meta, Projeto, ProjetoDados } from "./projects-store";

// Em builds Vite, VITE_API_URL é injetada em tempo de compilação; fallback garante uso local.
const rawApiUrl = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";
const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

export type UserRole = "admin" | "editor" | "user";

export interface UserAccount {
  id: string;
  nome: string;
  username: string;
  role: UserRole;
  ativo: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  user: UserAccount;
}

export interface UserCreatePayload {
  nome: string;
  username: string;
  password: string;
  role: UserRole;
  ativo: boolean;
}

export interface UserUpdatePayload {
  nome: string;
  username: string;
  role: UserRole;
  ativo: boolean;
}

let activeAuthToken: string | null = null;
let unauthorizedCallback: (() => void) | null = null;

/** Atualiza o token JWT enviado no cabeçalho Authorization das requisições subsequentes. */
export function setAuthToken(token: string | null): void {
  activeAuthToken = token;
}

/** Registra o redirecionamento automático quando o backend responder 401 (sessão expirada/inválida). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedCallback = handler;
}

/** Erro HTTP tipado para exibir mensagens de validação vindas do backend. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // Evita definir Content-Type manual em FormData para o navegador incluir o boundary multipart.
  if (init?.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (activeAuthToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${activeAuthToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor da API.", 0);
  }

  if (!response.ok) {
    let message = `Erro na comunicação com o servidor (${response.status}).`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
        message = payload.detail;
      }
    } catch {
      // Mantém mensagem padrão caso a resposta de erro não seja JSON.
    }

    // Dispara logout automático em 401 apenas quando havia uma sessão ativa.
    if (response.status === 401 && path !== "/api/auth/login" && activeAuthToken) {
      unauthorizedCallback?.();
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const headers = new Headers();
  if (activeAuthToken) {
    headers.set("Authorization", `Bearer ${activeAuthToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor da API.", 0);
  }

  if (!response.ok) {
    if (response.status === 401 && activeAuthToken) {
      unauthorizedCallback?.();
    }
    let message = `Não foi possível baixar o arquivo (${response.status}).`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
        message = payload.detail;
      }
    } catch {
      // Mantém mensagem padrão caso o erro não venha em JSON.
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export const apiClient = {
  // Autenticação
  login: (username: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<UserAccount>("/api/auth/me"),

  // Gerenciamento de usuários (somente administrador)
  listUsers: () => request<UserAccount[]>("/api/users"),
  createUser: (data: UserCreatePayload) =>
    request<UserAccount>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: UserUpdatePayload) =>
    request<UserAccount>(`/api/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  resetUserPassword: (id: string, newPassword: string) =>
    request<UserAccount>(`/api/users/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
  deleteUser: (id: string) =>
    request<void>(`/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // Catálogo global de status
  listStatuses: () => request<StatusOption[]>("/api/statuses"),
  createStatus: (option: StatusOption) =>
    request<StatusOption>("/api/statuses", {
      method: "POST",
      body: JSON.stringify(option),
    }),
  updateStatus: (option: StatusOption) =>
    request<StatusOption>(`/api/statuses/${encodeURIComponent(option.id)}`, {
      method: "PUT",
      body: JSON.stringify({ label: option.label, tone: option.tone }),
    }),
  deleteStatus: (id: string, substituteStatusId: string) =>
    request<{ statuses: StatusOption[]; reassigned_goals: number }>(
      `/api/statuses/${encodeURIComponent(id)}?substitute_status_id=${encodeURIComponent(substituteStatusId)}`,
      { method: "DELETE" },
    ),

  // Projetos (Visão Geral)
  listProjects: () => request<Projeto[]>("/api/projetos"),
  createProject: (data: ProjetoDados) =>
    request<Projeto>("/api/projetos", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProjectOverview: (id: string, data: ProjetoDados) =>
    request<Projeto>(`/api/projetos/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    request<void>(`/api/projetos/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  concludeProject: (id: string) =>
    request<Projeto>(`/api/projetos/${encodeURIComponent(id)}/concluir`, {
      method: "POST",
    }),
  uploadRelatorio: (projetoId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Projeto>(`/api/projetos/${encodeURIComponent(projetoId)}/relatorio`, {
      method: "POST",
      body: form,
    });
  },
  downloadRelatorio: (projetoId: string, filename: string) =>
    downloadFile(`/api/projetos/${encodeURIComponent(projetoId)}/relatorio/download`, filename),
  deleteRelatorio: (projetoId: string) =>
    request<Projeto>(`/api/projetos/${encodeURIComponent(projetoId)}/relatorio`, {
      method: "DELETE",
    }),

  // Metas
  createMeta: (projetoId: string, body: Partial<Omit<Meta, "id">> = {}) =>
    request<Meta>(`/api/projetos/${encodeURIComponent(projetoId)}/metas`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMeta: (projetoId: string, metaId: string, patch: Partial<Meta>) =>
    request<Meta>(
      `/api/projetos/${encodeURIComponent(projetoId)}/metas/${encodeURIComponent(metaId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    ),
  deleteMeta: (projetoId: string, metaId: string) =>
    request<void>(
      `/api/projetos/${encodeURIComponent(projetoId)}/metas/${encodeURIComponent(metaId)}`,
      { method: "DELETE" },
    ),

  // Acompanhamento Temporal
  createAcompanhamento: (
    projetoId: string,
    body: Partial<Omit<Acompanhamento, "id">> = {},
  ) =>
    request<Acompanhamento>(
      `/api/projetos/${encodeURIComponent(projetoId)}/acompanhamentos`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  updateAcompanhamento: (
    projetoId: string,
    itemId: string,
    patch: Partial<Acompanhamento>,
  ) =>
    request<Acompanhamento>(
      `/api/projetos/${encodeURIComponent(projetoId)}/acompanhamentos/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    ),
  deleteAcompanhamento: (projetoId: string, itemId: string) =>
    request<void>(
      `/api/projetos/${encodeURIComponent(projetoId)}/acompanhamentos/${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    ),
  uploadAcompanhamentoAnexos: (projetoId: string, itemId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file);
    }
    return request<Acompanhamento>(
      `/api/projetos/${encodeURIComponent(projetoId)}/acompanhamentos/${encodeURIComponent(itemId)}/anexos`,
      {
        method: "POST",
        body: form,
      },
    );
  },
  downloadAcompanhamentoAnexo: (
    projetoId: string,
    itemId: string,
    anexoId: string,
    filename: string,
  ) =>
    downloadFile(
      `/api/projetos/${encodeURIComponent(projetoId)}/acompanhamentos/${encodeURIComponent(itemId)}/anexos/${encodeURIComponent(anexoId)}/download`,
      filename,
    ),
  deleteAcompanhamentoAnexo: (projetoId: string, itemId: string, anexoId: string) =>
    request<Acompanhamento>(
      `/api/projetos/${encodeURIComponent(projetoId)}/acompanhamentos/${encodeURIComponent(itemId)}/anexos/${encodeURIComponent(anexoId)}`,
      { method: "DELETE" },
    ),

  // Custos / Investimentos
  createCusto: (projetoId: string, body: Partial<Omit<Custo, "id">> = {}) =>
    request<Custo>(`/api/projetos/${encodeURIComponent(projetoId)}/custos`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCusto: (projetoId: string, itemId: string, patch: Partial<Custo>) =>
    request<Custo>(
      `/api/projetos/${encodeURIComponent(projetoId)}/custos/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    ),
  deleteCusto: (projetoId: string, itemId: string) =>
    request<void>(
      `/api/projetos/${encodeURIComponent(projetoId)}/custos/${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    ),
};
