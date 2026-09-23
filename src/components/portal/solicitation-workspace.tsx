import { useState } from "react";
import { useRequests } from "@/lib/data/hooks";
import { useSession } from "@/lib/auth/session";
import { AppShell } from "./app-shell";
import { PageHeader } from "./page-header";
import { RequestTable } from "./request-table";
import { NewRequestDialog } from "./new-request-dialog";
import { Button } from "@/components/ui/button";

export function SolicitationWorkspace({ origem }: { origem: "medico" | "comercial" }) {
  const { user } = useSession();
  const { data: requests = [], isLoading, error } = useRequests();
  const [filter, setFilter] = useState("pendentes");
  const rows = requests.filter(
    (r) =>
      filter === "todos" ||
      (filter === "aprovados" ? r.status === "concluido" : r.status !== "concluido"),
  );
  return (
    <AppShell>
      <PageHeader
        title={origem === "medico" ? `Olá, ${user?.nome ?? ""}` : "Área Comercial"}
        description="Crie solicitações e acompanhe a aprovação de Custos. O orçamento aprovado fica disponível para impressão."
        actions={<NewRequestDialog origem={origem} trigger={<Button>Nova solicitação</Button>} />}
      />
      <label className="flex items-center gap-3 text-sm">
        Exibir
        <select
          className="rounded border bg-background p-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="pendentes">Aguardando Custos</option>
          <option value="aprovados">Aprovados</option>
          <option value="todos">Todos</option>
        </select>
      </label>
      {isLoading ? (
        <p>Carregando solicitações…</p>
      ) : error ? (
        <p role="alert">Não foi possível carregar as solicitações.</p>
      ) : rows.length ? (
        <RequestTable requests={rows} />
      ) : (
        <p>Nenhuma solicitação neste filtro.</p>
      )}
    </AppShell>
  );
}
