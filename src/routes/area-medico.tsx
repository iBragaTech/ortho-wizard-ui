import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/area-medico")({
  beforeLoad: () => {
    throw redirect({ to: "/orcamentos", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Área do Médico — Portal de Orçamentos" },
      {
        name: "description",
        content:
          "Espaço do médico para preencher honorários das consultas particulares solicitadas.",
      },
      { property: "og:title", content: "Área do Médico — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Solicitações aguardando honorários e histórico de preenchimentos do médico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
