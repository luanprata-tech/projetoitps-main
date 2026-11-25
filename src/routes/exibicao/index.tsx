import { createFileRoute } from "@tanstack/react-router";
import { ProjectsOverviewPage } from "@/components/projects-overview";

export const Route = createFileRoute("/exibicao/")({
  head: () => ({
    meta: [
      { title: "Modo de Exibição | ProjetosITPS" },
      {
        name: "description",
        content: "Visualização pública somente leitura de projetos de pesquisa e extensão.",
      },
      { property: "og:title", content: "Modo de Exibição | ProjetosITPS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Visualização pública de projetos." },
    ],
  }),
  component: ExibicaoIndex,
});

function ExibicaoIndex() {
  return <ProjectsOverviewPage mode="active" publicView />;
}
