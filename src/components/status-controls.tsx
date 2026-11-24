import { useState } from "react";
import { Check, Pencil, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useProjects } from "@/lib/projects-store";
import { statusTones, type StatusOption, type StatusTone } from "@/lib/status-options";

function StatusLabel({ option }: { option: StatusOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`size-2 shrink-0 rounded-full ${statusTones[option.tone].bar}`} />
      <span className="whitespace-normal break-words">{option.label}</span>
    </span>
  );
}

export function StatusPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const { statuses } = useProjects();
  const option = statuses.find((s) => s.id === value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={`h-auto min-h-9 w-40 max-w-full gap-2 rounded-md text-xs font-medium shadow-none transition-colors ${statusTones[option?.tone ?? "neutral"].badge}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-w-64">
        {statuses.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
            className="py-2.5 focus:bg-secondary focus:text-secondary-foreground"
          >
            <StatusLabel option={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: StatusOption;
  onSave: (s: StatusOption) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [tone, setTone] = useState(initial.tone);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ ...initial, label, tone });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-3 rounded-md border bg-muted/40 p-3" onSubmit={handleSubmit}>
      <label className="block space-y-1 text-sm font-medium">
        <span>Nome do status</span>
        <Input
          autoFocus
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError("");
          }}
          maxLength={60}
          required
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Cor</legend>
        <div className="flex gap-2">
          {(Object.keys(statusTones) as StatusTone[]).map((t) => (
            <Button
              key={t}
              type="button"
              variant="outline"
              size="icon"
              title={statusTones[t].label}
              aria-label={`Cor ${statusTones[t].label}`}
              aria-pressed={tone === t}
              onClick={() => setTone(t)}
              className={`size-8 ${statusTones[t].badge} ${tone === t ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}
            >
              {tone === t ? <Check /> : <span className={`size-3 rounded-full ${statusTones[t].bar}`} />}
            </Button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X />
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          <Save />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

export function StatusManager() {
  const { statuses, projetos, saveStatus, removeStatus, uid } = useProjects();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StatusOption | null>(null);
  const [deleting, setDeleting] = useState<StatusOption | null>(null);
  const [replacement, setReplacement] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingBusy, setDeletingBusy] = useState(false);

  const uses = (id: string) =>
    projetos.reduce((sum, p) => sum + p.metas.filter((m) => m.status === id).length, 0);

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    setDeleteError("");
    try {
      await removeStatus(deleting.id, replacement);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível remover o status.");
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setEditing(null);
        setDeleting(null);
        setDeleteError("");
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title="Gerenciar status">
        <Settings2 />
        <span className="hidden sm:inline">Status</span>
      </Button>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="tracking-normal">Status das metas</DialogTitle>
          <DialogDescription>Opções compartilhadas por todos os projetos do ProjetosITPS.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {statuses.map((s) =>
            editing?.id === s.id ? (
              <StatusEditor
                key={s.id}
                initial={editing}
                onSave={async (option) => {
                  await saveStatus(option);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b py-3">
                <div className="min-w-0 space-y-1">
                  <div
                    className={`inline-flex max-w-full rounded-md border px-3 py-1.5 text-sm font-medium ${statusTones[s.tone].badge}`}
                  >
                    <StatusLabel option={s} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {uses(s.id)} {uses(s.id) === 1 ? "meta" : "metas"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`Editar ${s.label}`}
                    aria-label={`Editar ${s.label}`}
                    onClick={() => {
                      setEditing(s);
                      setDeleting(null);
                      setDeleteError("");
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={statuses.length === 1}
                    title={statuses.length === 1 ? "Mantenha pelo menos um status" : `Remover ${s.label}`}
                    aria-label={`Remover ${s.label}`}
                    onClick={() => {
                      setDeleting(s);
                      setEditing(null);
                      setDeleteError("");
                      setReplacement(statuses.find((o) => o.id !== s.id)?.id ?? "");
                    }}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
        {deleting && (
          <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium">Remover “{deleting.label}”?</p>
            {uses(deleting.id) > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {uses(deleting.id)} metas serão transferidas para:
                </p>
                <Select value={replacement} onValueChange={setReplacement}>
                  <SelectTrigger aria-label="Status substituto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses
                      .filter((s) => s.id !== deleting.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {deleteError && (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)} disabled={deletingBusy}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deletingBusy}>
                <Trash2 />
                {deletingBusy ? "Removendo..." : "Confirmar remoção"}
              </Button>
            </div>
          </div>
        )}
        {editing && !statuses.some((s) => s.id === editing.id) && (
          <StatusEditor
            key={editing.id}
            initial={editing}
            onSave={async (option) => {
              await saveStatus(option);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
        {!editing && !deleting && (
          <Button variant="outline" onClick={() => setEditing({ id: uid(), label: "", tone: "planned" })}>
            <Plus />
            Adicionar status
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
