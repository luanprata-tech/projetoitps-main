export type StatusTone = "planned" | "progress" | "done" | "alert" | "neutral";
export interface StatusOption { id: string; label: string; tone: StatusTone }
export const initialStatuses: StatusOption[] = [
  { id: "Planejado", label: "Planejado", tone: "planned" },
  { id: "Em Andamento", label: "Em Andamento", tone: "progress" },
  { id: "Concluído", label: "Concluído", tone: "done" },
];
export const statusTones: Record<StatusTone, { label: string; badge: string; bar: string }> = {
  planned: { label: "Azul", badge: "bg-planned-soft text-planned border-planned/30", bar: "bg-planned" },
  progress: { label: "Âmbar", badge: "bg-progress-soft text-progress border-progress/30", bar: "bg-progress" },
  done: { label: "Verde", badge: "bg-done-soft text-done border-done/30", bar: "bg-done" },
  alert: { label: "Vermelho", badge: "bg-destructive/10 text-destructive border-destructive/30", bar: "bg-destructive" },
  neutral: { label: "Cinza", badge: "bg-muted text-muted-foreground border-input", bar: "bg-muted-foreground" },
};
export function saveStatusOption(options: StatusOption[], option: StatusOption): StatusOption[] {
  const label = option.label.trim();
  if (!label) throw new Error("Informe o nome do status.");
  if (options.some((s) => s.id !== option.id && s.label.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"))) throw new Error("Já existe um status com esse nome.");
  const next = { ...option, label };
  return options.some((s) => s.id === option.id) ? options.map((s) => s.id === option.id ? next : s) : [...options, next];
}
export function removeStatusOption<T extends { metas: { status: string }[] }>(options: StatusOption[], projects: T[], id: string, replacement: string) {
  if (options.length <= 1) throw new Error("Mantenha pelo menos um status.");
  if (!options.some((s) => s.id === id)) throw new Error("Status não encontrado.");
  if (!options.some((s) => s.id === replacement && s.id !== id)) throw new Error("Escolha um status substituto.");
  return {
    statuses: options.filter((s) => s.id !== id),
    projetos: projects.map((p) => ({ ...p, metas: p.metas.map((m) => m.status === id ? { ...m, status: replacement } : m) })),
  };
}