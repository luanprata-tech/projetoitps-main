import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Paperclip,
  Plus,
  Trash2,
  Target,
  CalendarClock,
  Wallet,
  Settings2,
  RefreshCw,
  X,
  Download,
  Upload,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useProjects, fmtDate, type Acompanhamento } from "@/lib/projects-store";
import { useAuth } from "@/lib/auth-store";
import { StatusManager, StatusPicker } from "@/components/status-controls";
import { statusTones } from "@/lib/status-options";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MoneyCell } from "@/components/money-cell";
import { goalProgress } from "@/lib/goal-progress";

const cell =
  "w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-input focus:border-ring focus:bg-card focus:outline-none";
const th = "px-3 py-3 font-medium";

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={title} className="w-full overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <AccordionTrigger className="gap-3 font-display text-lg hover:no-underline sm:text-xl">
            <span className="flex items-center gap-2">
              {icon}
              {title}
            </span>
          </AccordionTrigger>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <AccordionContent className="border-t pb-0">
        <div className="overflow-x-auto">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

const AddBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <Button variant="outline" size="sm" onClick={onClick}>
    <Plus />
    {label}
  </Button>
);

/**
 * Detalhes e plano de trabalho do projeto, compartilhado entre a rota autenticada e /exibicao.
 */
export function ProjectDetailsPage({
  id,
  de,
  publicView = false,
}: {
  id: string;
  de?: "plano" | "concluidos" | undefined;
  publicView?: boolean;
}) {
  const { canEdit: authCanEdit } = useAuth();
  // O modo de exibição pública (/exibicao) força visualização somente leitura mesmo com sessão ativa.
  const canEdit = publicView ? false : authCanEdit;
  const {
    projetos,
    statuses,
    loading,
    error,
    syncError,
    clearSyncError,
    reload,
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
  } = useProjects();

  const [openSections, setOpenSections] = useState<string[]>([]);
  const [deletingAcomp, setDeletingAcomp] = useState<Acompanhamento | null>(null);
  const [deletingAcompBusy, setDeletingAcompBusy] = useState(false);
  const openSection = (title: string) =>
    setOpenSections((prev) => (prev.includes(title) ? prev : [...prev, title]));

  const p = projetos.find((x) => x.id === id);

  if (loading && !p) {
    return <p className="text-sm text-muted-foreground">Carregando plano de trabalho...</p>;
  }

  if (error && !p) {
    return (
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
    );
  }

  if (!p) {
    return (
      <p>
        Projeto não encontrado.{" "}
        <Link to={publicView ? "/exibicao" : "/"} className="text-primary underline">
          Voltar
        </Link>
      </p>
    );
  }

  const media = p.metas.length
    ? Math.round(
        p.metas.reduce((a, m) => a + goalProgress(m.semestres, m.semestresAtivos), 0) /
          p.metas.length,
      )
    : 0;
  const totalCusto = p.custos.reduce((a, c) => a + c.valor, 0);

  const backTarget =
    de === "plano"
      ? publicView
        ? "/exibicao/plano"
        : "/plano"
      : de === "concluidos" && !publicView
        ? "/concluidos"
        : publicView
          ? "/exibicao"
          : "/";

  return (
    <div className="space-y-6">
      <Link
        to={backTarget}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {de === "plano"
          ? "Voltar ao Plano de Trabalho"
          : de === "concluidos" && !publicView
            ? "Voltar aos Projetos Concluídos"
            : "Voltar à visão geral"}
      </Link>

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

      <header className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium uppercase tracking-wider text-primary">{p.edital}</p>
              {p.concluido && (
                <span className="rounded bg-done-soft px-2 py-0.5 text-xs font-semibold text-done">
                  Concluído
                </span>
              )}
            </div>
            <h1 className="mt-1 font-display text-3xl">{p.titulo}</h1>
            <p className="mt-3 text-muted-foreground">
              <strong className="text-foreground">Objetivo:</strong> {p.objetivo}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-md bg-secondary px-5 py-3 text-center">
              <p className="text-xs text-secondary-foreground">Progresso geral</p>
              <p className="font-display text-3xl text-primary">{media}%</p>
            </div>
          </div>
        </div>
      </header>

      {/* Acordeão múltiplo mantém todas as seções independentes e com a mesma largura. */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-6"
      >
        <Section
          icon={<Target className="size-5 text-primary" />}
          title="Metas e Atividades"
          action={
            canEdit ? (
              <div className="flex gap-2">
                <StatusManager />
                <AddBtn
                  label="Nova meta"
                  onClick={() => {
                    // Abre a seção automaticamente para tornar a nova meta visível de imediato.
                    openSection("Metas e Atividades");
                    void addMeta(p.id);
                  }}
                />
              </div>
            ) : undefined
          }
        >
          <table className="project-table w-full min-w-[1100px] text-sm">
            <thead className="bg-muted text-center text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className={th}>Meta</th>
                <th className={th}>Descrição da Atividade</th>
                {[
                  ["1º Sem.", "(Ano 1)"],
                  ["2º Sem.", "(Ano 1)"],
                  ["3º Sem.", "(Ano 2)"],
                  ["4º Sem.", "(Ano 2)"],
                ].map(([a, b]) => (
                  <th key={a} className={`${th} text-center`}>
                    {a}
                    <br />
                    {b}
                  </th>
                ))}
                <th className={th}>Status</th>
                <th className={th}>% Progresso</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.metas.map((m) => {
                const progresso = goalProgress(m.semestres, m.semestresAtivos);
                const statusOpt = statuses.find((s) => s.id === m.status);
                const tone = statusTones[statusOpt?.tone ?? "neutral"];
                return (
                  <tr key={m.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <span className="rounded bg-secondary px-2 py-1 font-mono text-xs font-semibold text-secondary-foreground">
                        {m.codigo}
                      </span>
                    </td>
                    <td className="w-[38%] px-3 py-2">
                      {canEdit ? (
                        <textarea
                          rows={2}
                          className={`${cell} resize-none`}
                          value={m.descricao}
                          placeholder="Descreva a atividade"
                          onChange={(e) => updateMeta(p.id, m.id, { descricao: e.target.value })}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words px-2 py-1 text-sm">
                          {m.descricao || "—"}
                        </p>
                      )}
                    </td>
                    {m.semestres.map((v, i) => (
                      <td key={i} className="px-3 py-2 text-center">
                        {m.semestresAtivos[i] ? (
                          <input
                            type="checkbox"
                            aria-label={`${m.codigo}: semestre ${i + 1} concluído`}
                            className="size-4 accent-primary"
                            checked={v}
                            disabled={!canEdit}
                            onChange={() => {
                              if (!canEdit) return;
                              const s = [...m.semestres] as typeof m.semestres;
                              s[i] = !v;
                              updateMeta(p.id, m.id, { semestres: s }, true);
                            }}
                          />
                        ) : (
                          <span aria-label={`Semestre ${i + 1} inativo`}>-</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <StatusPicker
                          value={m.status}
                          label={`Status ${m.codigo}`}
                          onChange={(status) => updateMeta(p.id, m.id, { status }, true)}
                        />
                      ) : (
                        <span
                          className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium ${tone.badge}`}
                        >
                          <span className={`size-2 shrink-0 rounded-full ${tone.bar}`} />
                          {statusOpt?.label ?? m.status}
                        </span>
                      )}
                    </td>
                    <td className="min-w-[180px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${tone.bar}`}
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                        <output aria-label={`Progresso ${m.codigo}`} className="w-12 shrink-0 text-center text-xs tabular-nums">
                          {progresso}%
                        </output>
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-2">
                        <div className="flex justify-center gap-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Configurar semestres"
                                aria-label={`Configurar semestres ${m.codigo}`}
                              >
                                <Settings2 />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="space-y-3">
                              <h3 className="font-medium">Semestres ativos · {m.codigo}</h3>
                              {m.semestresAtivos.map((active, i) => (
                                <label key={i} className="flex items-center gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    checked={active}
                                    onChange={() => {
                                      const ativos = [...m.semestresAtivos] as typeof m.semestresAtivos;
                                      const checked = [...m.semestres] as typeof m.semestres;
                                      ativos[i] = !active;
                                      // Zera a conclusão do semestre reconfigurado para manter coerência com o planejamento.
                                      checked[i] = false;
                                      updateMeta(
                                        p.id,
                                        m.id,
                                        { semestresAtivos: ativos, semestres: checked },
                                        true,
                                      );
                                    }}
                                  />
                                  {i + 1}º semestre · Ano {i < 2 ? 1 : 2}
                                </label>
                              ))}
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remover meta"
                            aria-label={`Remover meta ${m.codigo}`}
                            onClick={() => void removeMeta(p.id, m.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          icon={<CalendarClock className="size-5 text-primary" />}
          title="Acompanhamento Temporal"
          action={
            canEdit ? (
              <AddBtn
                label="Registro"
                onClick={() => {
                  // Abre a seção automaticamente para tornar o novo registro visível de imediato.
                  openSection("Acompanhamento Temporal");
                  void addAcompanhamento(p.id);
                }}
              />
            ) : undefined
          }
        >
          <table className="project-table w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col className="w-36" />
              <col />
              <col />
              <col className="w-20" />
              {canEdit && <col className="w-10" />}
            </colgroup>
            <thead className="bg-muted text-center text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className={`${th} date-cell`}>Data</th>
                <th className={th}>Descrição</th>
                <th className={th}>Justificativa</th>
                <th className={th}>Anexos</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.acompanhamentos.map((a) => (
                <tr key={a.id}>
                  <td className="date-cell px-2 py-2">
                    {canEdit ? (
                      <input
                        type="date"
                        className={cell}
                        value={a.data}
                        onChange={(e) =>
                          updateAcompanhamento(p.id, a.id, { data: e.target.value }, true)
                        }
                      />
                    ) : (
                      <span>{fmtDate(a.data)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <textarea
                        rows={2}
                        className={`${cell} resize-none`}
                        value={a.descricao}
                        onChange={(e) =>
                          updateAcompanhamento(p.id, a.id, { descricao: e.target.value })
                        }
                      />
                    ) : (
                      <p className="whitespace-pre-wrap break-words px-2 py-1 text-sm">
                        {a.descricao || "—"}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <textarea
                        rows={2}
                        className={`${cell} resize-none`}
                        value={a.justificativa}
                        onChange={(e) =>
                          updateAcompanhamento(p.id, a.id, { justificativa: e.target.value })
                        }
                      />
                    ) : (
                      <p className="whitespace-pre-wrap break-words px-2 py-1 text-sm">
                        {a.justificativa || "—"}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          title={canEdit ? "Gerenciar anexos" : "Visualizar e baixar anexos"}
                        >
                          <Paperclip className="size-3.5" />
                          {a.anexos}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-medium">Anexos</h3>
                          {canEdit && (
                            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                              <Upload className="size-3.5" />
                              Enviar
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const list = Array.from(e.target.files ?? []);
                                  if (list.length > 0) {
                                    void uploadAcompanhamentoAnexos(p.id, a.id, list);
                                  }
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                        {(a.anexosLista ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum arquivo anexado.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {(a.anexosLista ?? []).map((anexo) => (
                              <li
                                key={anexo.id}
                                className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-xs"
                              >
                                <span
                                  className="min-w-0 flex-1 truncate"
                                  title={anexo.caminhoRede}
                                >
                                  {anexo.nome}
                                </span>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    title={`Baixar ${anexo.nome}`}
                                    onClick={() =>
                                      void downloadAcompanhamentoAnexo(
                                        p.id,
                                        a.id,
                                        anexo.id,
                                        anexo.nome,
                                      )
                                    }
                                    className="cursor-pointer rounded p-1 text-primary hover:bg-muted"
                                  >
                                    <Download className="size-3.5" />
                                  </button>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      title={`Remover ${anexo.nome}`}
                                      onClick={() =>
                                        void deleteAcompanhamentoAnexo(p.id, a.id, anexo.id)
                                      }
                                      className="cursor-pointer rounded p-1 text-destructive hover:bg-muted"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </PopoverContent>
                    </Popover>
                  </td>
                  {canEdit && (
                    <td className="px-2">
                      <button
                        type="button"
                        title="Excluir registro de acompanhamento"
                        aria-label={`Excluir acompanhamento de ${fmtDate(a.data)}`}
                        onClick={() => setDeletingAcomp(a)}
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!p.acompanhamentos.length && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum registro ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        <Section
          icon={<Wallet className="size-5 text-primary" />}
          title="Custos / Investimentos"
          action={
            canEdit ? (
              <AddBtn
                label="Custo"
                onClick={() => {
                  // Abre a seção automaticamente para tornar o novo custo visível de imediato.
                  openSection("Custos / Investimentos");
                  void addCusto(p.id);
                }}
              />
            ) : undefined
          }
        >
          <table className="project-table w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col className="w-36" />
              <col />
              <col className="w-32" />
              <col className="w-40" />
              {canEdit && <col className="w-10" />}
            </colgroup>
            <thead className="bg-muted text-center text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className={`${th} date-cell`}>Data</th>
                <th className={th}>Material</th>
                <th className={th}>Tipo</th>
                <th className={`${th} text-center`}>Valor (R$)</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.custos.map((c) => (
                <tr key={c.id}>
                  <td className="date-cell px-2 py-2">
                    {canEdit ? (
                      <input
                        type="date"
                        className={cell}
                        value={c.data}
                        onChange={(e) => updateCusto(p.id, c.id, { data: e.target.value }, true)}
                      />
                    ) : (
                      <span>{fmtDate(c.data)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <textarea
                        rows={1}
                        aria-label={`Material ${c.id}`}
                        className={`${cell} resize-none`}
                        value={c.material}
                        onChange={(e) => updateCusto(p.id, c.id, { material: e.target.value })}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap break-words px-2 py-1 text-sm">
                        {c.material || "—"}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        className={`${cell} ${c.tipo === "Permanente" ? "text-primary" : ""}`}
                        value={c.tipo}
                        onChange={(e) =>
                          updateCusto(
                            p.id,
                            c.id,
                            { tipo: e.target.value as "Consumo" | "Permanente" },
                            true,
                          )
                        }
                      >
                        <option>Consumo</option>
                        <option>Permanente</option>
                      </select>
                    ) : (
                      <span className={c.tipo === "Permanente" ? "text-primary" : ""}>{c.tipo}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <MoneyCell
                        value={c.valor}
                        label={`Valor de ${c.material || "novo custo"}`}
                        onChange={(valor) => updateCusto(p.id, c.id, { valor })}
                      />
                    ) : (
                      <MoneyCell value={c.valor} />
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-2">
                      <button
                        onClick={() => void removeCusto(p.id, c.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!p.custos.length && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum custo registrado.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted font-semibold">
                <td colSpan={3} className="px-4 py-3">
                  Total investido
                </td>
                <td className="px-4 py-3 text-center text-primary">
                  <MoneyCell value={totalCusto} />
                </td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </Section>
      </Accordion>

      {deletingAcomp && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !deletingAcompBusy) setDeletingAcomp(null);
          }}
        >
          <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl tracking-normal">
                Excluir acompanhamento
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o registro de{" "}
                <strong>{fmtDate(deletingAcomp.data)}</strong>?{" "}
                {deletingAcomp.anexos > 0
                  ? `Os ${deletingAcomp.anexos} anexo(s) vinculados e a pasta correspondente no servidor também serão excluídos permanentemente.`
                  : "A pasta correspondente no servidor (se houver) também será removida."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingAcomp(null)}
                disabled={deletingAcompBusy}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingAcompBusy}
                onClick={async () => {
                  setDeletingAcompBusy(true);
                  try {
                    await removeAcompanhamento(p.id, deletingAcomp.id);
                    setDeletingAcomp(null);
                  } finally {
                    setDeletingAcompBusy(false);
                  }
                }}
              >
                <Trash2 />
                {deletingAcompBusy ? "Excluindo..." : "Confirmar exclusão"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
