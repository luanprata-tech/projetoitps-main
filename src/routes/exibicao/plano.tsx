import { createFileRoute } from "@tanstack/react-router";
import { PlanoTrabalhoPage } from "@/components/plano-page";

export const Route = createFileRoute("/exibicao/plano")({
  head: () => ({
    meta: [
      { title: "Plano de Trabalho (Exibição) | ProjetosITPS" },
      { name: "description", content: "Escolha um projeto para visualizar o plano de trabalho." },
      { property: "og:title", content: "Plano de Trabalho (Exibição) | ProjetosITPS" },
      { property: "og:description", content: "Visualização pública do plano de trabalho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExibicaoPlano,
});

function ExibicaoPlano() {
  return <PlanoTrabalhoPage publicView />;
}

