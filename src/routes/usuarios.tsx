import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  apiClient,
  type UserAccount,
  type UserCreatePayload,
  type UserRole,
  type UserUpdatePayload,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Gerenciar Usuários | ProjetosITPS" },
      { name: "description", content: "Cadastro, edição e redefinição de senhas de usuários." },
    ],
  }),
  component: GerenciarUsuarios,
});

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

function formatCreatedAt(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
}

function GerenciarUsuarios() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [resetting, setResetting] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState<UserAccount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listUsers();
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const total = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const editors = users.filter((u) => u.role === "editor").length;
  const ativos = users.filter((u) => u.ativo).length;

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await apiClient.deleteUser(deleting.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
      setFeedback(`Usuário "${deleting.nome}" removido com sucesso.`);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível remover o usuário.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary">Administração</p>
          <h1 className="font-display text-3xl">Gerenciar Usuários</h1>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Novo Usuário
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadUsers()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {feedback && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-done/30 bg-done-soft px-4 py-3 text-sm text-done">
          <span>{feedback}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFeedback(null)}
            aria-label="Fechar mensagem"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Total de usuários", loading ? "…" : total],
          ["Administradores", loading ? "…" : admins],
          ["Editores", loading ? "…" : editors],
          ["Ativos", loading ? "…" : ativos],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-display text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="project-table w-full min-w-[780px] text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="date-cell px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando usuários...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isSelf = currentUser?.id === u.id;
              return (
                <tr key={u.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      {u.nome}
                      {isSelf && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          Você
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                        u.role === "admin"
                          ? "border-planned/30 bg-planned-soft text-planned"
                          : u.role === "editor"
                            ? "border-progress/30 bg-progress-soft text-progress"
                            : "border-input bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.role === "admin" ? (
                        <Shield className="size-3.5" />
                      ) : u.role === "editor" ? (
                        <Pencil className="size-3.5" />
                      ) : (
                        <UserIcon className="size-3.5" />
                      )}
                      {u.role === "admin"
                        ? "Administrador"
                        : u.role === "editor"
                          ? "Editor"
                          : "Usuário"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${
                        u.ativo
                          ? "border-done/30 bg-done-soft text-done"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="date-cell whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatCreatedAt(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar usuário"
                        aria-label={`Editar usuário ${u.nome}`}
                        onClick={() => setEditing(u)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Resetar senha"
                        aria-label={`Resetar senha de ${u.nome}`}
                        onClick={() => setResetting(u)}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf}
                        title={isSelf ? "Você não pode excluir sua própria conta" : "Remover usuário"}
                        aria-label={`Remover usuário ${u.nome}`}
                        onClick={() => {
                          setDeleting(u);
                          setDeleteError("");
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <UsuarioCreateDialog
          onClose={() => setCreating(false)}
          onSave={async (payload) => {
            const created = await apiClient.createUser(payload);
            setUsers((prev) => [...prev, created]);
            setFeedback(`Usuário "${created.nome}" criado com sucesso.`);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <UsuarioEditDialog
          user={editing}
          isSelf={currentUser?.id === editing.id}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const updated = await apiClient.updateUser(editing.id, payload);
            setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setFeedback(`Usuário "${updated.nome}" atualizado com sucesso.`);
            setEditing(null);
          }}
        />
      )}

      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          onClose={() => setResetting(null)}
          onSave={async (newPassword) => {
            await apiClient.resetUserPassword(resetting.id, newPassword);
            setFeedback(`Senha de "${resetting.nome}" redefinida com sucesso.`);
            setResetting(null);
          }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(v) => !v && !deleteBusy && setDeleting(null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl tracking-normal">
                Remover usuário
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a conta de <strong>{deleting.nome}</strong> (
                {deleting.username})? Esta ação não pode ser desfeita.
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
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteBusy}>
                <Trash2 />
                {deleteBusy ? "Removendo..." : "Confirmar remoção"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function UsuarioCreateDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (payload: UserCreatePayload) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ nome, username, password, role, ativo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100%-2rem)] max-w-lg rounded-lg bg-card"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-normal">Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span>Nome</span>
            <input required className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Nome de usuário (sem espaços)</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={60}
              placeholder="ex.: maria.silva"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Senha inicial (mínimo 6 caracteres)</span>
            <input
              type="password"
              required
              minLength={6}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span>Perfil</span>
              <select
                className={inputClass}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="user">Usuário (somente visualização)</option>
                <option value="editor">Editor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Conta ativa
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Save />
              {saving ? "Criando..." : "Criar usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsuarioEditDialog({
  user,
  isSelf,
  onClose,
  onSave,
}: {
  user: UserAccount;
  isSelf: boolean;
  onClose: () => void;
  onSave: (payload: UserUpdatePayload) => Promise<void>;
}) {
  const [nome, setNome] = useState(user.nome);
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<UserRole>(user.role);
  const [ativo, setAtivo] = useState(user.ativo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ nome, username, role, ativo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o usuário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100%-2rem)] max-w-lg rounded-lg bg-card"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-normal">Editar Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span>Nome</span>
            <input required className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Nome de usuário (sem espaços)</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={60}
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span>Perfil</span>
              <select
                className={inputClass}
                value={role}
                disabled={isSelf}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="user">Usuário (somente visualização)</option>
                <option value="editor">Editor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={ativo}
                disabled={isSelf}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Conta ativa
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Save />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onSave,
}: {
  user: UserAccount;
  onClose: () => void;
  onSave: (newPassword: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("As senhas informadas não conferem.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-normal">Resetar senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha de acesso para <strong>{user.nome}</strong> ({user.username}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span>Nova senha (mínimo 6 caracteres)</span>
            <input
              type="password"
              required
              minLength={6}
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              required
              minLength={6}
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <KeyRound />
              {saving ? "Salvando..." : "Redefinir senha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
