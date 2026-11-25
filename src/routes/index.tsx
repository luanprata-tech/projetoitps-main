import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  Plus,
  Upload,
  Pencil,
  Save,
  Trash2,
  ChevronRight,
  RefreshCw,
  X,
  Download,
} from "lucide-react";
import { useProjects, fmtDate, type Projeto, type ProjetoDados } from "@/lib/projects-store";
import { useAuth } from "@/lib/auth-store";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral de Projetos | ProjetosITPS" },
      { name: "description", content: "Painel de projetos de pesquisa e extensão: editais, bolsistas, relatórios e impacto social." },
      { property: "og:title", content: "Visão Geral de Projetos | ProjetosITPS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Painel de projetos de pesquisa e extensão." },
    ],
  }),
  component: Index,
});

const input =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

function toOverviewPayload(p: Projeto, overrides?: Partial<ProjetoDados>): ProjetoDados {
  return {
    titulo: p.titulo,
    edital: p.edital,
    objetivo: p.objetivo,
    inicio: p.inicio,
    fim: p.fim,
    supervisor: p.supervisor,
    bolsistas: p.bolsistas,
    relatorio: p.relatorio,
    impacto: p.impacto,
    ...overrides,
  };
}

function Index() {
  const { canEdit } = useAuth();
  const {
    projetos,
    loading,
    error,
    syncError,
    clearSyncError,
    reload,
    add,
    updateOverview,
    removeProject,
    uploadRelatorio,
    downloadRelatorio,
    deleteRelatorio,
  } = useProjects();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Projeto | null>(null);
  const [deleting, setDeleting] = useState<Projeto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const total = projetos.length,
    ativos = projetos.filter((p) => !p.relatorio).length;
  const bolsistas = projetos.reduce((a, p) => a + p.bolsistas.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary">Pesquisa & Extensão</p>
          <h1 className="font-display text-3xl">Visão Geral de Projetos</h1>
        </div>
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Adicionar Novo Projeto
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {syncError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{syncError}</span>
          <Button variant="ghost" size="icon" onClick={clearSyncError} aria-label="Fechar aviso">
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Projetos", loading ? "…" : total],
          ["Em execução", loading ? "…" : ativos],
          ["Bolsistas", loading ? "…" : bolsistas],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className="font-display text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="project-table w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: canEdit ? "13.5%" : "19.5%" }} />
            {canEdit && <col style={{ width: "6%" }} />}
          </colgroup>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {[
                "Título do Projeto",
                "Edital",
                "Objetivo",
                "Início",
                "Finalização",
                "Supervisor(a)",
                "Bolsistas",
                "Relatório\nFinal",
                "Impacto Social",
                ...(canEdit ? ["Ações"] : []),
              ].map((h) => (
                <th
                  key={h}
                  className={`whitespace-pre-line px-2 py-3 font-medium ${h === "Início" || h === "Finalização" ? "date-cell" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && projetos.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando projetos...
                </td>
              </tr>
            )}
            {!loading && projetos.length === 0 && !error && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum projeto cadastrado.
                </td>
              </tr>
            )}
            {projetos.map((p) => (
              <tr key={p.id} className="hover:bg-muted/50">
                <td className="break-words px-4 py-4">
                  <Link
                    to="/projeto/$id"
                    params={{ id: p.id }}
                    className="group flex items-center justify-start gap-1 font-medium text-primary hover:underline"
                  >
                    {p.titulo}
                    <ChevronRight className="mt-0.5 size-4 shrink-0" />
                  </Link>
                </td>
                <td className="break-words px-4 py-4 text-muted-foreground">{p.edital}</td>
                <td className="whitespace-normal break-words px-4 py-4 text-muted-foreground">{p.objetivo}</td>
                <td className="date-cell whitespace-nowrap px-3 py-4">{fmtDate(p.inicio)}</td>
                <td className="date-cell whitespace-nowrap px-3 py-4">{fmtDate(p.fim)}</td>
                <td className="break-words px-4 py-4">{p.supervisor}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-start gap-1">
                    {p.bolsistas.map((b, idx) => (
                      <span key={`${b.nome}-${idx}`} className="break-words">
                        <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                          {b.modalidade}
                        </span>
                        {b.nome}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-1 py-4 text-center">
                  {p.relatorio ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        title={`Baixar relatório: ${p.relatorioNome ?? p.relatorio}${p.relatorioCaminhoRede ? `\n${p.relatorioCaminhoRede}` : ""}`}
                        aria-label={`Baixar relatório: ${p.relatorioNome ?? p.relatorio}`}
                        onClick={() =>
                          void downloadRelatorio(p.id, p.relatorioNome ?? "relatorio-final")
                        }
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-done-soft text-done hover:opacity-90"
                      >
                        <FileText className="size-4" />
                      </button>
                      {canEdit && (
                        <label
                          title="Substituir relatório final"
                          aria-label={`Substituir relatório final de ${p.titulo}`}
                          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        >
                          <Upload className="size-3.5" />
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadRelatorio(p.id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  ) : canEdit ? (
                    <label
                      title="Enviar relatório final"
                      aria-label="Enviar relatório final"
                      className="mx-auto flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      <Upload className="size-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadRelatorio(p.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="whitespace-normal break-words px-4 py-4 text-muted-foreground">{p.impacto}</td>
                {canEdit && (
                  <td className="px-1 py-4">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar projeto"
                        aria-label={`Editar projeto: ${p.titulo}`}
                        onClick={() => setEditing(p)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir projeto"
                        aria-label={`Excluir projeto: ${p.titulo}`}
                        onClick={() => {
                          setDeleting(p);
                          setDeleteError("");
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <ProjetoForm
          onClose={() => setOpen(false)}
          onSave={async (d, file) => {
            await add(d, file);
            setOpen(false);
          }}
        />
      )}
      {editing && (
        <ProjetoForm
          project={editing}
          onClose={() => setEditing(null)}
          onDownloadRelatorio={() =>
            void downloadRelatorio(editing.id, editing.relatorioNome ?? "relatorio-final")
          }
          onDeleteRelatorio={async () => {
            await deleteRelatorio(editing.id);
            setEditing((curr) =>
              curr
                ? { ...curr, relatorio: null, relatorioNome: null, relatorioCaminhoRede: null }
                : null,
            );
          }}
          onSave={async (d, file) => {
            // Salva apenas campos da visão geral para preservar metas, acompanhamentos e custos.
            await updateOverview(editing.id, d, file);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <Dialog open onOpenChange={(v) => !v && !deleteBusy && setDeleting(null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl tracking-normal">
                Excluir projeto
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o projeto <strong>{deleting.titulo}</strong> do
                sistema? A pasta e os arquivos salvos na pasta compartilhada do servidor serão
                mantidos.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteBusy}
                onClick={async () => {
                  setDeleteBusy(true);
                  setDeleteError("");
                  try {
                    await removeProject(deleting.id);
                    setDeleting(null);
                  } catch (err) {
                    setDeleteError(
                      err instanceof Error ? err.message : "Não foi possível excluir o projeto.",
                    );
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                <Trash2 />
                {deleteBusy ? "Excluindo..." : "Confirmar exclusão"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ProjetoForm({
  project,
  onClose,
  onSave,
  onDownloadRelatorio,
  onDeleteRelatorio,
}: {
  project?: Projeto;
  onClose: () => void;
  onSave: (data: ProjetoDados, relatorioFile?: File | null) => Promise<void>;
  onDownloadRelatorio?: () => void;
  onDeleteRelatorio?: () => Promise<void>;
}) {
  const [f, setF] = useState<ProjetoDados>(() => ({
    titulo: project?.titulo ?? "",
    edital: project?.edital ?? "",
    objetivo: project?.objetivo ?? "",
    inicio: project?.inicio ?? "",
    fim: project?.fim ?? "",
    supervisor: project?.supervisor ?? "",
    bolsistas: project?.bolsistas.map((b) => ({ ...b })) ?? [],
    impacto: project?.impacto ?? "",
    relatorio: project?.relatorio ?? null,
  }));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const set =
    (k: "titulo" | "edital" | "objetivo" | "inicio" | "fim" | "supervisor" | "impacto") =>
    (e: { target: { value: string } }) =>
      setF((v) => ({ ...v, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await onSave(f, selectedFile);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !saving) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg bg-card"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-normal">
            {project ? "Editar Projeto" : "Novo Projeto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Título
              <input required className={input} value={f.titulo} onChange={set("titulo")} />
            </label>
            <label className="text-sm">
              Edital
              <input className={input} value={f.edital} onChange={set("edital")} />
            </label>
            <label className="text-sm">
              Supervisor(a)
              <input className={input} value={f.supervisor} onChange={set("supervisor")} />
            </label>
            <label className="text-sm sm:col-span-2">
              Objetivo
              <textarea rows={3} className={input} value={f.objetivo} onChange={set("objetivo")} />
            </label>
            <label className="text-sm">
              Início
              <input type="date" className={input} value={f.inicio} onChange={set("inicio")} />
            </label>
            <label className="text-sm">
              Finalização
              <input type="date" className={input} value={f.fim} onChange={set("fim")} />
            </label>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="mb-2 text-sm">Bolsistas</legend>
              {f.bolsistas.map((b, i) => (
                <div key={i} className="flex items-end gap-2">
                  <label className="w-24 shrink-0 text-xs text-muted-foreground">
                    Modalidade
                    <input
                      aria-label={`Modalidade do bolsista ${i + 1}`}
                      className={input}
                      value={b.modalidade}
                      onChange={(e) =>
                        setF((v) => ({
                          ...v,
                          bolsistas: v.bolsistas.map((x, j) =>
                            j === i ? { ...x, modalidade: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="min-w-0 flex-1 text-xs text-muted-foreground">
                    Nome
                    <input
                      aria-label={`Nome do bolsista ${i + 1}`}
                      className={input}
                      value={b.nome}
                      onChange={(e) =>
                        setF((v) => ({
                          ...v,
                          bolsistas: v.bolsistas.map((x, j) =>
                            j === i ? { ...x, nome: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Remover bolsista"
                    aria-label={`Remover bolsista ${i + 1}`}
                    onClick={() =>
                      setF((v) => ({ ...v, bolsistas: v.bolsistas.filter((_, j) => j !== i) }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setF((v) => ({ ...v, bolsistas: [...v.bolsistas, { modalidade: "", nome: "" }] }))
                }
              >
                <Plus />
                Adicionar bolsista
              </Button>
            </fieldset>
            <div className="space-y-2 sm:col-span-2">
              <span className="block text-sm">Relatório Final</span>
              {project?.relatorio && !selectedFile && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {project.relatorioNome ?? project.relatorio}
                    </p>
                    {project.relatorioCaminhoRede && (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {project.relatorioCaminhoRede}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {onDownloadRelatorio && (
                      <Button type="button" variant="outline" size="sm" onClick={onDownloadRelatorio}>
                        <Download className="size-3.5" />
                        Baixar
                      </Button>
                    )}
                    {onDeleteRelatorio && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await onDeleteRelatorio();
                          setF((v) => ({ ...v, relatorio: null }));
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <label className="block text-xs text-muted-foreground">
                {project?.relatorio ? "Substituir arquivo do relatório" : "Enviar arquivo do relatório"}
                <input
                  type="file"
                  className={`${input} mt-1`}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setSelectedFile(file);
                  }}
                />
              </label>
            </div>
            <label className="text-sm sm:col-span-2">
              Impacto Social
              <textarea rows={2} className={input} value={f.impacto} onChange={set("impacto")} />
            </label>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Save />
              {saving ? "Salvando..." : project ? "Salvar alterações" : "Salvar projeto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
