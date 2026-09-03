import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, History, Plus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewRequestDialog } from "@/components/portal/new-request-dialog";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { MetricCard } from "@/components/portal/metric-card";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/portal/empty-state";
import { DoctorFeeDialog } from "@/components/portal/doctor-fee-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, medicalFeesTotal, type ConsultationRequest } from "@/data/mock";
import { useRequests } from "@/lib/data/hooks";

export const Route = createFileRoute("/area-medico")({
  head: () => ({
    meta: [
      { title: "Área do Médico — Portal de Orçamentos" },
      {
        name: "description",
        content: "Espaço do médico para preencher honorários das consultas particulares solicitadas.",
      },
      { property: "og:title", content: "Área do Médico — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Solicitações aguardando honorários e histórico de preenchimentos do médico.",
      },
    ],
  }),
  component: AreaMedico,
});

const medico = "Dr. Ricardo Menezes";

function RequestRow({ request }: { request: ConsultationRequest }) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{request.numero}</p>
        <p className="truncate text-sm font-semibold text-foreground">{request.paciente.nome}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {request.especialidade} · {request.data}
        </p>
        <div className="mt-2">
          <StatusBadge status={request.status} />
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <p className="text-sm font-semibold text-foreground sm:text-right">
          {formatCurrency(medicalFeesTotal(request))}
        </p>
        <DoctorFeeDialog request={request} />
      </div>
    </div>
  );
}

function AreaMedico() {
  const { data: requests = [] } = useRequests();
  const meus = requests;
  const aguardando = meus.filter((r) => r.honorariosMedicos === null);
  const preenchidas = meus.filter((r) => r.honorariosMedicos !== null);

  return (
    <AppShell>
      <PageHeader
        title={`Olá, ${medico}`}
        description="Crie orçamentos com os dados médicos e acompanhe os que dependem do seu preenchimento."
        actions={
          <NewRequestDialog
            origem="medico"
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Novo orçamento
              </Button>
            }
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Aguardando seus honorários"
          value={aguardando.length}
          icon={Stethoscope}
          tone="warning"
          hint={`${aguardando.length} solicitações aguardando seus honorários`}
        />
        <MetricCard label="Já preenchidas" value={preenchidas.length} icon={CheckCircle2} tone="success" />
        <MetricCard label="Total no histórico" value={meus.length} icon={History} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Minhas solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="aguardando">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="aguardando" className="flex-1 sm:flex-none">
                Aguardando
              </TabsTrigger>
              <TabsTrigger value="preenchidas" className="flex-1 sm:flex-none">
                Preenchidas
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex-1 sm:flex-none">
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aguardando" className="mt-4 space-y-3">
              {aguardando.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nada pendente por aqui" />
              ) : (
                aguardando.map((r) => <RequestRow key={r.id} request={r} />)
              )}
            </TabsContent>
            <TabsContent value="preenchidas" className="mt-4 space-y-3">
              {preenchidas.map((r) => (
                <RequestRow key={r.id} request={r} />
              ))}
            </TabsContent>
            <TabsContent value="historico" className="mt-4 space-y-3">
              {meus.map((r) => (
                <RequestRow key={r.id} request={r} />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AppShell>
  );
}
