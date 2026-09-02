import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FileText,
  Search,
  Stethoscope,
  Timer,
} from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { MetricCard } from "@/components/portal/metric-card";
import { RequestTable } from "@/components/portal/request-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequests } from "@/lib/data/hooks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Portal de Orçamentos de Consultas" },
      {
        name: "description",
        content:
          "Painel interno com indicadores de solicitações, honorários médicos e valores hospitalares.",
      },
      { property: "og:title", content: "Dashboard — Portal de Orçamentos de Consultas" },
      {
        property: "og:description",
        content: "Acompanhe solicitações, honorários e orçamentos em um único portal hospitalar.",
      },
    ],
  }),
  component: Dashboard,
});

const flow = [
  { label: "Solicitação", icon: ClipboardList, desc: "Registro inicial" },
  { label: "Médico", icon: Stethoscope, desc: "Honorários médicos" },
  { label: "Comercial", icon: Briefcase, desc: "Valores hospitalares" },
  { label: "Orçamento", icon: FileText, desc: "Valor total ao paciente" },
];

function Dashboard() {
  const { data: requests = [] } = useRequests();
  const metrics = {
    pendentes: requests.filter((r) => r.status === "pendente").length,
    emAnalise: requests.filter((r) => r.status === "em_analise").length,
    aguardandoMedico: requests.filter((r) => r.status === "aguardando_medico").length,
    aguardandoComercial: requests.filter((r) => r.status === "aguardando_comercial").length,
    concluidos: requests.filter((r) => r.status === "concluido").length,
  };

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Visão geral dos orçamentos de consultas particulares."
        actions={
          <Button asChild>
            <Link to="/orcamentos">
              Ver orçamentos <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Pendentes" value={metrics.pendentes} icon={ClipboardList} hint="Aguardando triagem" />
        <MetricCard label="Em análise" value={metrics.emAnalise} icon={Search} hint="Sob avaliação interna" />
        <MetricCard
          label="Aguardando médico"
          value={metrics.aguardandoMedico}
          icon={Stethoscope}
          tone="warning"
          hint="Honorários pendentes"
        />
        <MetricCard
          label="Aguardando Comercial"
          value={metrics.aguardandoComercial}
          icon={Briefcase}
          hint="Valores hospitalares"
        />
        <MetricCard
          label="Orçamentos concluídos"
          value={metrics.concluidos}
          icon={CheckCircle2}
          tone="success"
          hint="Prontos para envio"
        />
      </div>

      <Card className="shadow-card">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Fluxo atual das solicitações</CardTitle>
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Representação inicial — sujeita a ajustes
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {flow.map((step, i) => (
              <div key={step.label} className="relative">
                <div className="h-full rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-accent-foreground">
                      <step.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{step.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                </div>
                {i < flow.length - 1 ? (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground md:block" />
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-lg font-semibold text-foreground">Orçamentos recentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/orcamentos">Ver todas</Link>
          </Button>
        </div>
        <RequestTable requests={requests.slice(0, 6)} />
      </section>
    </AppShell>
  );
}
