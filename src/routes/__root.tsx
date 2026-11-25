import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "../lib/auth-store";
import { ProjectsProvider } from "../lib/projects-store";
import { FlaskConical, LayoutGrid, LogOut, Users } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Você pode tentar novamente ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Cada rota de conteúdo (incluindo /) deve definir seu próprio head().
    // Nunca adicione og:image ou twitter:image na raiz para não sobrescrever outras páginas.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ProjetosITPS" },
      { name: "description", content: "Acompanhamento de projetos de pesquisa e extensão" },
      { property: "og:title", content: "ProjetosITPS" },
      { property: "og:description", content: "Acompanhamento de projetos de pesquisa e extensão" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppShell() {
  const { user, ready, isAuthenticated, isAdmin, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isLoginRoute = pathname === "/login";
  const isAdminOnlyRoute = pathname === "/usuarios";

  // Impede acesso forçado por URL quando o usuário não está autenticado ou não é administrador.
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated && !isLoginRoute) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (isAuthenticated && isLoginRoute) {
      void navigate({ to: "/", replace: true });
      return;
    }
    if (isAuthenticated && isAdminOnlyRoute && !isAdmin) {
      void navigate({ to: "/", replace: true });
    }
  }, [ready, isAuthenticated, isAdmin, isLoginRoute, isAdminOnlyRoute, navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-sans text-sm text-muted-foreground">
        Verificando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    if (!isLoginRoute) return null;
    return (
      <div className="min-h-screen font-sans">
        <Outlet />
      </div>
    );
  }

  if (isLoginRoute || (isAdminOnlyRoute && !isAdmin)) {
    return null;
  }

  return (
    <div className="min-h-screen font-sans">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <FlaskConical className="size-5" />
              </span>
              <span className="font-display text-xl">ProjetosITPS</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent" }}
              >
                <LayoutGrid className="size-4" />
                Visão Geral
              </Link>
              <Link
                to="/plano"
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent" }}
              >
                <FlaskConical className="size-4" />
                Plano de Trabalho
              </Link>
              {isAdmin && (
                <Link
                  to="/usuarios"
                  className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent" }}
                >
                  <Users className="size-4" />
                  Usuários
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <p className="font-medium leading-tight">{user?.nome}</p>
              <p className="text-xs text-sidebar-foreground/70">
                {user?.role === "admin"
                  ? "Administrador"
                  : user?.role === "editor"
                    ? "Editor"
                    : "Usuário"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-sidebar-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar-accent"
            >
              <LogOut className="size-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-6 py-8">
        {/* Obrigatório: as rotas filhas são renderizadas aqui; remover <Outlet /> quebra a navegação. */}
        <Outlet />
      </main>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectsProvider>
          <AppShell />
        </ProjectsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
