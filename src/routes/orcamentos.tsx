import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { RequestTable } from "@/components/portal/request-table";
import { EmptyState } from "@/components/portal/empty-state";
import { MetricCard } from "@/components/portal/metric-card";
import { CheckCircle2, Wallet } from "lucide-react";
import { formatCurrency, requests, totalOf } from "@/data/mock";

export const Route = createFileRoute("/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Portal de Orçamentos" },
      {
        name: "description",
        content: "Orçamentos concluídos com honorários médicos e valores hospitalares consolidados.",
      },
      { property: "og:title", content: "Orçamentos — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Acompanhe os orçamentos finalizados e prontos para envio ao paciente.",
      },
    ],
  }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const concluidos = requests.filter((r) => r.status === "concluido");
  const soma = concluidos.reduce((acc, r) => acc + (totalOf(r) ?? 0), 0);
  const media = concluidos.length ? soma / concluidos.length : 0;

  return (
    <AppShell>
      <PageHeader
        title="Orçamentos"
        description="Orçamentos finalizados a partir dos honorários médicos e valores hospitalares."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Concluídos" value={concluidos.length} icon={CheckCircle2} tone="success" />
        <MetricCard label="Valor consolidado" value={formatCurrency(soma)} icon={Wallet} />
        <MetricCard label="Ticket médio" value={formatCurrency(media)} icon={FileText} />
      </div>

      {concluidos.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum orçamento concluído" />
      ) : (
        <RequestTable requests={concluidos} />
      )}
    </AppShell>
  );
}
