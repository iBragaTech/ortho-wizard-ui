import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileSearch, FileText, Plus, Wallet } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { RequestTable } from "@/components/portal/request-table";
import { EmptyState } from "@/components/portal/empty-state";
import { MetricCard } from "@/components/portal/metric-card";
import { SearchAndFilters, type Filters } from "@/components/portal/search-and-filters";
import { NewRequestDialog } from "@/components/portal/new-request-dialog";
import { formatCurrency, totalOf } from "@/data/mock";
import { useRequests } from "@/lib/data/hooks";

export const Route = createFileRoute("/orcamentos/")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Portal de Orçamentos" },
      {
        name: "description",
        content:
          "Todos os orçamentos de consultas particulares, com filtros por status, médico, especialidade e período.",
      },
      { property: "og:title", content: "Orçamentos — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Acompanhe orçamentos em andamento e finalizados em uma única lista.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const { data: requests = [] } = useRequests();
  const [filters, setFilters] = useState<Filters>({
    busca: "",
    status: "todos",
    medico: "todos",
    especialidade: "todas",
    periodo: "30",
  });

  const concluidos = requests.filter((r) => r.status === "concluido");
  const soma = concluidos.reduce((acc, r) => acc + (totalOf(r) ?? 0), 0);
  const media = concluidos.length ? soma / concluidos.length : 0;

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
    [filters, requests],
  );

  return (
    <AppShell>
      <PageHeader
        title="Orçamentos"
        description="Todos os orçamentos registrados no portal, do pedido inicial ao valor consolidado."
        actions={
          <NewRequestDialog
            trigger={
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto">
                <Plus className="h-4 w-4" /> Novo orçamento
              </button>
            }
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Concluídos" value={concluidos.length} icon={CheckCircle2} tone="success" />
        <MetricCard label="Valor consolidado" value={formatCurrency(soma)} icon={Wallet} />
        <MetricCard label="Ticket médio" value={formatCurrency(media)} icon={FileText} />
      </div>

      <SearchAndFilters filters={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhum orçamento encontrado"
          description="Ajuste os filtros ou o termo de busca para visualizar outros resultados."
        />
      ) : (
        <RequestTable requests={filtered} />
      )}
    </AppShell>
  );
}
