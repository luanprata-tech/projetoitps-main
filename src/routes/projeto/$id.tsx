import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailsPage } from "@/components/project-details";

export const Route = createFileRoute("/projeto/$id")({
  head: () => ({
    meta: [
      { title: "Plano de Trabalho | ProjetosITPS" },
      { name: "description", content: "Metas, atividades, acompanhamento temporal e custos do plano de trabalho." },
      { property: "og:title", content: "Plano de Trabalho | ProjetosITPS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Metas, acompanhamento e custos do projeto." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { de?: "plano" | "concluidos" } =>
    s["de"] === "plano" || s["de"] === "concluidos" ? { de: s["de"] } : {},
  component: Detalhes,
});

function Detalhes() {
  const { id } = Route.useParams();
  const { de } = Route.useSearch();
  return <ProjectDetailsPage id={id} de={de} />;
}
