import { createFileRoute } from "@tanstack/react-router";
import { PlanoTrabalhoPage } from "@/components/plano-page";

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
  return <PlanoTrabalhoPage />;
}
