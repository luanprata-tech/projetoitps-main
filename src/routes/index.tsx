import { createFileRoute } from "@tanstack/react-router";
import { ProjectsOverviewPage } from "@/components/projects-overview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral de Projetos | ProjetosITPS" },
      {
        name: "description",
        content: "Painel de projetos de pesquisa e extensão: editais, bolsistas, relatórios e impacto social.",
      },
      { property: "og:title", content: "Visão Geral de Projetos | ProjetosITPS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Painel de projetos de pesquisa e extensão." },
    ],
  }),
  component: Index,
});

function Index() {
  return <ProjectsOverviewPage mode="active" />;
}
