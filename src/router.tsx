import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cria um QueryClient por requisição para evitar vazamento de cache entre requisições SSR.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Deixa o TanStack Query controlar a obsolescência; configure padrões de cache no QueryClient.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
