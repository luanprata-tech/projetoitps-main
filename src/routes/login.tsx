import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FlaskConical, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | ProjetosITPS" },
      { name: "description", content: "Acesso autenticado ao sistema ProjetosITPS." },
    ],
  }),
  component: LoginPage,
});

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    clearSessionMessage();
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl">ProjetosITPS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe suas credenciais para acessar o painel de projetos.
          </p>
        </div>

        {sessionMessage && (
          <div
            role="alert"
            className="rounded-md border border-progress/40 bg-progress-soft px-3 py-2.5 text-sm text-progress"
          >
            {sessionMessage}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">
            <span>Usuário</span>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              placeholder="nome.usuario"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            <span>Senha</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <Button type="submit" className="w-full" disabled={submitting}>
            <LogIn className="size-4" />
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
