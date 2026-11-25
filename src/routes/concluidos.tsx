import { createFileRoute } from "@tanstack/react-router";
import { ProjectsOverviewPage } from "@/components/projects-overview";

export const Route = createFileRoute("/concluidos")({
  head: () => ({
    meta: [
      { title: "Projetos Concluídos | ProjetosITPS" },
      {
        name: "description",
        content: "Painel de projetos de pesquisa e extensão concluídos e arquivados.",
      },
      { property: "og:title", content: "Projetos Concluídos | ProjetosITPS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Projetos de pesquisa e extensão concluídos." },
    ],
  }),
  component: Concluidos,
});

function Concluidos() {
  return <ProjectsOverviewPage mode="concluded" />;
}
