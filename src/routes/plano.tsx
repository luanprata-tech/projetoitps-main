import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/lib/projects-store";

export const Route = createFileRoute("/plano")({
  head: () => ({
    meta: [
      { title: "Plano de Trabalho | ProjetosITPS" },
      { name: "description", content: "Escolha um projeto para ver o plano de trabalho." },
      { property: "og:title", content: "Plano de Trabalho | ProjetosITPS" },
      { property: "og:description", content: "Escolha um projeto para ver o plano de trabalho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EscolherProjeto,
});

function EscolherProjeto() {
  const { projetos, loading, error, reload } = useProjects();
  return (
    <div className="space-y-6">
      <Button asChild size="lg">
        <Link to="/">
          <ArrowLeft />
          Voltar à Visão Geral
        </Link>
      </Button>
      <div>
        <h1 className="font-display text-3xl">Plano de Trabalho</h1>
        <p className="mt-1 text-muted-foreground">Escolha um projeto para abrir o plano de trabalho.</p>
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
      {loading && projetos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Carregando projetos...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map((p) => (
            <Link
              key={p.id}
              to="/projeto/$id"
              params={{ id: p.id }}
              search={{ de: "plano" }}
              className="group flex flex-col rounded-lg border bg-card p-5 transition-colors hover:border-primary"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-primary">{p.edital}</p>
              <h2 className="mt-1 font-display text-lg">{p.titulo}</h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.objetivo}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Abrir plano
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
