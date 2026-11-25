import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { apiClient } from "./api-client";
import { useAuth } from "./auth-store";
import type { Semestres } from "./goal-progress";
import {
  initialStatuses,
  removeStatusOption,
  saveStatusOption,
  type StatusOption,
} from "./status-options";

export type Status = string;
export interface Meta {
  id: string;
  codigo: string;
  descricao: string;
  semestres: Semestres;
  semestresAtivos: Semestres;
  status: Status;
}
export interface AnexoItem {
  id: string;
  nome: string;
  caminho: string;
  caminhoRede: string;
  tamanho: number;
}
export interface Acompanhamento {
  id: string;
  data: string;
  descricao: string;
  justificativa: string;
  anexos: number;
  anexosLista?: AnexoItem[];
}
export interface Custo {
  id: string;
  data: string;
  material: string;
  tipo: "Consumo" | "Permanente";
  valor: number;
}
export interface Projeto {
  id: string;
  titulo: string;
  edital: string;
  objetivo: string;
  inicio: string;
  fim: string;
  supervisor: string;
  pasta?: string;
  concluido: boolean;
  bolsistas: { modalidade: string; nome: string }[];
  relatorio: string | null;
  relatorioNome?: string | null;
  relatorioCaminhoRede?: string | null;
  impacto: string;
  metas: Meta[];
  acompanhamentos: Acompanhamento[];
  custos: Custo[];
}

export type ProjetoDados = Omit<
  Projeto,
  | "id"
  | "pasta"
  | "concluido"
  | "relatorioNome"
  | "relatorioCaminhoRede"
  | "metas"
  | "acompanhamentos"
  | "custos"
>;

const uid = () => Math.random().toString(36).slice(2, 9);

// Atraso curto para edição inline em textareas/inputs numéricos, evitando requisições por tecla.
const INLINE_DEBOUNCE_MS = 350;

interface Ctx {
  projetos: Projeto[];
  statuses: StatusOption[];
  loading: boolean;
  error: string | null;
  syncError: string | null;
  clearSyncError: () => void;
  reload: () => Promise<void>;
  saveStatus: (option: StatusOption) => Promise<void>;
  removeStatus: (id: string, replacement: string) => Promise<void>;
  add: (p: ProjetoDados, relatorioFile?: File | null) => Promise<void>;
  updateOverview: (id: string, data: ProjetoDados, relatorioFile?: File | null) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  concludeProject: (id: string) => Promise<void>;
  uploadRelatorio: (projetoId: string, file: File) => Promise<void>;
  downloadRelatorio: (projetoId: string, filename: string) => Promise<void>;
  deleteRelatorio: (projetoId: string) => Promise<void>;
  addMeta: (projetoId: string) => Promise<void>;
  updateMeta: (
    projetoId: string,
    metaId: string,
    patch: Partial<Meta>,
    immediate?: boolean,
  ) => void;
  removeMeta: (projetoId: string, metaId: string) => Promise<void>;
  addAcompanhamento: (projetoId: string) => Promise<void>;
  updateAcompanhamento: (
    projetoId: string,
    itemId: string,
    patch: Partial<Acompanhamento>,
    immediate?: boolean,
  ) => void;
  removeAcompanhamento: (projetoId: string, itemId: string) => Promise<void>;
  uploadAcompanhamentoAnexos: (projetoId: string, itemId: string, files: File[]) => Promise<void>;
  downloadAcompanhamentoAnexo: (
    projetoId: string,
    itemId: string,
    anexoId: string,
    filename: string,
  ) => Promise<void>;
  deleteAcompanhamentoAnexo: (projetoId: string, itemId: string, anexoId: string) => Promise<void>;
  addCusto: (projetoId: string) => Promise<void>;
  updateCusto: (
    projetoId: string,
    itemId: string,
    patch: Partial<Custo>,
    immediate?: boolean,
  ) => void;
  removeCusto: (projetoId: string, itemId: string) => Promise<void>;
  uid: () => string;
}

const C = createContext<Ctx | null>(null);

function extractErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { ready, isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublicViewRoute = pathname === "/exibicao" || pathname.startsWith("/exibicao/");
  const shouldLoadData = isAuthenticated || isPublicViewRoute;

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>(initialStatuses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Agrupa alterações pendentes por item para enviar um único PATCH consolidado após o debounce.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPatchesRef = useRef<Map<string, Record<string, unknown>>>(new Map());

  const reload = useCallback(async () => {
    if (!shouldLoadData) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedStatuses, loadedProjects] = await Promise.all([
        apiClient.listStatuses(),
        apiClient.listProjects(),
      ]);
      setStatuses(loadedStatuses);
      setProjetos(loadedProjects);
    } catch (err) {
      setError(extractErrorMessage(err, "Não foi possível carregar os projetos."));
    } finally {
      setLoading(false);
    }
  }, [shouldLoadData]);

  useEffect(() => {
    if (!ready) return;
    const timers = timersRef.current;
    // Cancela edições pendentes ao trocar de sessão (login/logout) ou sair do modo público.
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    pendingPatchesRef.current.clear();

    if (!shouldLoadData) {
      // Limpa dados em memória na tela de login para não expor informações entre contas.
      setProjetos([]);
      setStatuses(initialStatuses);
      setError(null);
      setSyncError(null);
      setLoading(false);
      return;
    }

    setSyncError(null);
    void reload();
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [ready, shouldLoadData, isAuthenticated, reload]);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  const scheduleInlinePatch = useCallback(
    (
      key: string,
      patch: Record<string, unknown>,
      immediate: boolean,
      sender: (mergedPatch: Record<string, unknown>) => Promise<void>,
    ) => {
      const merged = { ...(pendingPatchesRef.current.get(key) ?? {}), ...patch };
      pendingPatchesRef.current.set(key, merged);

      const existingTimer = timersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        timersRef.current.delete(key);
      }

      const flush = async () => {
        const payload = pendingPatchesRef.current.get(key);
        pendingPatchesRef.current.delete(key);
        timersRef.current.delete(key);
        if (!payload) return;
        try {
          await sender(payload);
          setSyncError(null);
        } catch (err) {
          setSyncError(extractErrorMessage(err, "Erro ao salvar alterações."));
          void reload();
        }
      };

      if (immediate) {
        void flush();
        return;
      }

      const timer = setTimeout(() => {
        void flush();
      }, INLINE_DEBOUNCE_MS);
      timersRef.current.set(key, timer);
    },
    [reload],
  );

  const add: Ctx["add"] = async (data, relatorioFile) => {
    let created = await apiClient.createProject(data);
    if (relatorioFile) {
      created = await apiClient.uploadRelatorio(created.id, relatorioFile);
    }
    setProjetos((prev) => [...prev, created]);
    setSyncError(null);
  };

  const updateOverview: Ctx["updateOverview"] = async (id, data, relatorioFile) => {
    let updated = await apiClient.updateProjectOverview(id, data);
    if (relatorioFile) {
      updated = await apiClient.uploadRelatorio(id, relatorioFile);
    }
    setProjetos((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setSyncError(null);
  };

  const removeProject: Ctx["removeProject"] = async (id) => {
    await apiClient.deleteProject(id);
    setProjetos((prev) => prev.filter((p) => p.id !== id));
    setSyncError(null);
  };

  const concludeProject: Ctx["concludeProject"] = async (id) => {
    const updated = await apiClient.concludeProject(id);
    setProjetos((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setSyncError(null);
  };

  const uploadRelatorio: Ctx["uploadRelatorio"] = async (projetoId, file) => {
    try {
      const updated = await apiClient.uploadRelatorio(projetoId, file);
      setProjetos((prev) => prev.map((p) => (p.id === projetoId ? updated : p)));
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível enviar o relatório final."));
    }
  };

  const downloadRelatorio: Ctx["downloadRelatorio"] = async (projetoId, filename) => {
    try {
      await apiClient.downloadRelatorio(projetoId, filename);
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível baixar o relatório final."));
    }
  };

  const deleteRelatorio: Ctx["deleteRelatorio"] = async (projetoId) => {
    try {
      const updated = await apiClient.deleteRelatorio(projetoId);
      setProjetos((prev) => prev.map((p) => (p.id === projetoId ? updated : p)));
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível remover o relatório final."));
    }
  };

  const saveStatus: Ctx["saveStatus"] = async (option) => {
    // Reutiliza validação pura local antes de enviar à API para feedback imediato.
    saveStatusOption(statuses, option);
    const exists = statuses.some((s) => s.id === option.id);
    const saved = exists
      ? await apiClient.updateStatus(option)
      : await apiClient.createStatus(option);
    setStatuses((prev) => saveStatusOption(prev, saved));
    setSyncError(null);
  };

  const removeStatus: Ctx["removeStatus"] = async (id, replacement) => {
    removeStatusOption(statuses, projetos, id, replacement);
    const result = await apiClient.deleteStatus(id, replacement);
    // Aplica também no estado local a reatribuição atômica das metas mantendo os semestres.
    setStatuses(result.statuses);
    setProjetos((prev) => removeStatusOption(statuses, prev, id, replacement).projetos);
    setSyncError(null);
  };

  const addMeta: Ctx["addMeta"] = async (projetoId) => {
    try {
      const created = await apiClient.createMeta(projetoId);
      setProjetos((prev) =>
        prev.map((p) => (p.id === projetoId ? { ...p, metas: [...p.metas, created] } : p)),
      );
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível adicionar a meta."));
    }
  };

  const updateMeta: Ctx["updateMeta"] = (projetoId, metaId, patch, immediate = false) => {
    setProjetos((prev) =>
      prev.map((p) =>
        p.id === projetoId
          ? { ...p, metas: p.metas.map((m) => (m.id === metaId ? { ...m, ...patch } : m)) }
          : p,
      ),
    );
    scheduleInlinePatch(`meta:${projetoId}:${metaId}`, patch, immediate, async (merged) => {
      await apiClient.updateMeta(projetoId, metaId, merged as Partial<Meta>);
    });
  };

  const removeMeta: Ctx["removeMeta"] = async (projetoId, metaId) => {
    const key = `meta:${projetoId}:${metaId}`;
    const timer = timersRef.current.get(key);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(key);
    pendingPatchesRef.current.delete(key);

    const snapshot = projetos;
    setProjetos((prev) =>
      prev.map((p) =>
        p.id === projetoId ? { ...p, metas: p.metas.filter((m) => m.id !== metaId) } : p,
      ),
    );
    try {
      await apiClient.deleteMeta(projetoId, metaId);
      setSyncError(null);
    } catch (err) {
      setProjetos(snapshot);
      setSyncError(extractErrorMessage(err, "Não foi possível remover a meta."));
    }
  };

  const addAcompanhamento: Ctx["addAcompanhamento"] = async (projetoId) => {
    try {
      const created = await apiClient.createAcompanhamento(projetoId);
      setProjetos((prev) =>
        prev.map((p) =>
          p.id === projetoId
            ? { ...p, acompanhamentos: [...p.acompanhamentos, created] }
            : p,
        ),
      );
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível adicionar o registro."));
    }
  };

  const updateAcompanhamento: Ctx["updateAcompanhamento"] = (
    projetoId,
    itemId,
    patch,
    immediate = false,
  ) => {
    setProjetos((prev) =>
      prev.map((p) =>
        p.id === projetoId
          ? {
              ...p,
              acompanhamentos: p.acompanhamentos.map((a) =>
                a.id === itemId ? { ...a, ...patch } : a,
              ),
            }
          : p,
      ),
    );
    scheduleInlinePatch(`acomp:${projetoId}:${itemId}`, patch, immediate, async (merged) => {
      await apiClient.updateAcompanhamento(
        projetoId,
        itemId,
        merged as Partial<Acompanhamento>,
      );
    });
  };

  const removeAcompanhamento: Ctx["removeAcompanhamento"] = async (projetoId, itemId) => {
    const key = `acomp:${projetoId}:${itemId}`;
    const timer = timersRef.current.get(key);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(key);
    pendingPatchesRef.current.delete(key);

    const snapshot = projetos;
    setProjetos((prev) =>
      prev.map((p) =>
        p.id === projetoId
          ? { ...p, acompanhamentos: p.acompanhamentos.filter((a) => a.id !== itemId) }
          : p,
      ),
    );
    try {
      await apiClient.deleteAcompanhamento(projetoId, itemId);
      setSyncError(null);
    } catch (err) {
      setProjetos(snapshot);
      setSyncError(extractErrorMessage(err, "Não foi possível remover o registro."));
    }
  };

  const uploadAcompanhamentoAnexos: Ctx["uploadAcompanhamentoAnexos"] = async (
    projetoId,
    itemId,
    files,
  ) => {
    if (files.length === 0) return;
    try {
      const updated = await apiClient.uploadAcompanhamentoAnexos(projetoId, itemId, files);
      setProjetos((prev) =>
        prev.map((p) =>
          p.id === projetoId
            ? {
                ...p,
                acompanhamentos: p.acompanhamentos.map((a) => (a.id === itemId ? updated : a)),
              }
            : p,
        ),
      );
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível enviar os anexos."));
    }
  };

  const downloadAcompanhamentoAnexo: Ctx["downloadAcompanhamentoAnexo"] = async (
    projetoId,
    itemId,
    anexoId,
    filename,
  ) => {
    try {
      await apiClient.downloadAcompanhamentoAnexo(projetoId, itemId, anexoId, filename);
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível baixar o anexo."));
    }
  };

  const deleteAcompanhamentoAnexo: Ctx["deleteAcompanhamentoAnexo"] = async (
    projetoId,
    itemId,
    anexoId,
  ) => {
    try {
      const updated = await apiClient.deleteAcompanhamentoAnexo(projetoId, itemId, anexoId);
      setProjetos((prev) =>
        prev.map((p) =>
          p.id === projetoId
            ? {
                ...p,
                acompanhamentos: p.acompanhamentos.map((a) => (a.id === itemId ? updated : a)),
              }
            : p,
        ),
      );
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível remover o anexo."));
    }
  };

  const addCusto: Ctx["addCusto"] = async (projetoId) => {
    try {
      const created = await apiClient.createCusto(projetoId);
      setProjetos((prev) =>
        prev.map((p) => (p.id === projetoId ? { ...p, custos: [...p.custos, created] } : p)),
      );
      setSyncError(null);
    } catch (err) {
      setSyncError(extractErrorMessage(err, "Não foi possível adicionar o custo."));
    }
  };

  const updateCusto: Ctx["updateCusto"] = (projetoId, itemId, patch, immediate = false) => {
    setProjetos((prev) =>
      prev.map((p) =>
        p.id === projetoId
          ? { ...p, custos: p.custos.map((c) => (c.id === itemId ? { ...c, ...patch } : c)) }
          : p,
      ),
    );
    scheduleInlinePatch(`custo:${projetoId}:${itemId}`, patch, immediate, async (merged) => {
      await apiClient.updateCusto(projetoId, itemId, merged as Partial<Custo>);
    });
  };

  const removeCusto: Ctx["removeCusto"] = async (projetoId, itemId) => {
    const key = `custo:${projetoId}:${itemId}`;
    const timer = timersRef.current.get(key);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(key);
    pendingPatchesRef.current.delete(key);

    const snapshot = projetos;
    setProjetos((prev) =>
      prev.map((p) =>
        p.id === projetoId ? { ...p, custos: p.custos.filter((c) => c.id !== itemId) } : p,
      ),
    );
    try {
      await apiClient.deleteCusto(projetoId, itemId);
      setSyncError(null);
    } catch (err) {
      setProjetos(snapshot);
      setSyncError(extractErrorMessage(err, "Não foi possível remover o custo."));
    }
  };

  return (
    <C.Provider
      value={{
        projetos,
        statuses,
        loading,
        error,
        syncError,
        clearSyncError,
        reload,
        saveStatus,
        removeStatus,
        add,
        updateOverview,
        removeProject,
        concludeProject,
        uploadRelatorio,
        downloadRelatorio,
        deleteRelatorio,
        addMeta,
        updateMeta,
        removeMeta,
        addAcompanhamento,
        updateAcompanhamento,
        removeAcompanhamento,
        uploadAcompanhamentoAnexos,
        downloadAcompanhamentoAnexo,
        deleteAcompanhamentoAnexo,
        addCusto,
        updateCusto,
        removeCusto,
        uid,
      }}
    >
      {children}
    </C.Provider>
  );
}

export const useProjects = () => {
  const c = useContext(C);
  if (!c) throw new Error("ProjectsProvider não encontrado na árvore de componentes.");
  return c;
};

export const fmtDate = (d: string) => (d ? new Date(d + "T00:00").toLocaleDateString("pt-BR") : "—");
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
