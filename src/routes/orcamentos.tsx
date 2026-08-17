import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/orcamentos")({
  component: OrcamentosLayout,
});

function OrcamentosLayout() {
  return <Outlet />;
}
