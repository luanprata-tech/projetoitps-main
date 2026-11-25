import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailsPage } from "@/components/project-details";

export const Route = createFileRoute("/exibicao/projeto/$id")({
  head: () => ({
    meta: [
      { title: "Plano de Trabalho (Exibição) | ProjetosITPS" },
      {
        name: "description",
        content: "Visualização pública das metas, acompanhamento temporal e custos do projeto.",
      },
      { property: "og:title", content: "Plano de Trabalho (Exibição) | ProjetosITPS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Visualização pública do projeto." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { de?: "plano" | "concluidos" } =>
    s["de"] === "plano" || s["de"] === "concluidos" ? { de: s["de"] } : {},
  component: ExibicaoDetalhes,
});

function ExibicaoDetalhes() {
  const { id } = Route.useParams();
  const { de } = Route.useSearch();
  return <ProjectDetailsPage id={id} de={de} publicView />;
}
