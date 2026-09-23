import { createFileRoute, redirect } from "@tanstack/react-router";

// Old bookmarks now lead to the workflow that uses the authenticated Tasy-linked user.
export const Route = createFileRoute("/medicos")({
  beforeLoad: () => {
    throw redirect({ to: "/orcamentos" });
  },
});
