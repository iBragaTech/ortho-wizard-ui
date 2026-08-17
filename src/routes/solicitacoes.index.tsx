import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileSearch, Plus } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { RequestTable } from "@/components/portal/request-table";
import { EmptyState } from "@/components/portal/empty-state";
import { SearchAndFilters, type Filters } from "@/components/portal/search-and-filters";
import { NewRequestDialog } from "@/components/portal/new-request-dialog";
import { requests } from "@/data/mock";

export const Route = createFileRoute("/solicitacoes/")({
  head: () => ({
    meta: [
      { title: "Solicitações — Portal de Orçamentos" },
      {
        name: "description",
        content: "Lista de solicitações de orçamento com filtros por status, médico e especialidade.",
      },
      { property: "og:title", content: "Solicitações — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Consulte e filtre todas as solicitações de orçamento de consultas particulares.",
      },
    ],
  }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const [filters, setFilters] = useState<Filters>({
    busca: "",
    status: "todos",
    medico: "todos",
    especialidade: "todas",
    periodo: "30",
  });

  const filtered = useMemo(
    () =>
      requests.filter((r) => {
        const q = filters.busca.trim().toLowerCase();
        if (q && !r.paciente.nome.toLowerCase().includes(q) && !r.numero.toLowerCase().includes(q))
          return false;
        if (filters.status !== "todos" && r.status !== filters.status) return false;
        if (filters.medico !== "todos" && r.medico !== filters.medico) return false;
        if (filters.especialidade !== "todas" && r.especialidade !== filters.especialidade)
          return false;
        return true;
      }),
    [filters],
  );

  return (
    <AppShell>
      <PageHeader
        title="Solicitações"
        description="Todas as solicitações de orçamento registradas no portal."
        actions={
          <NewRequestDialog
            trigger={
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto">
                <Plus className="h-4 w-4" /> Nova solicitação
              </button>
            }
          />
        }
      />

      <SearchAndFilters filters={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhuma solicitação encontrada"
          description="Ajuste os filtros ou o termo de busca para visualizar outros resultados."
        />
      ) : (
        <RequestTable requests={filtered} />
      )}
    </AppShell>
  );
}
