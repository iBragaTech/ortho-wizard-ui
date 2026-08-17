import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Briefcase, Info, Stethoscope } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { PatientInfoCard, InfoField } from "@/components/portal/patient-info-card";
import { FinancialSummary } from "@/components/portal/financial-summary";
import { Timeline } from "@/components/portal/timeline";
import { StatusBadge } from "@/components/portal/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, requests, timelineEvents } from "@/data/mock";

export const Route = createFileRoute("/solicitacoes/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes da solicitação — Portal de Orçamentos" },
      {
        name: "description",
        content: "Dados do paciente, consulta, honorários médicos, valores hospitalares e histórico.",
      },
      { property: "og:title", content: "Detalhes da solicitação — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Visualize o orçamento completo de uma solicitação de consulta particular.",
      },
    ],
  }),
  loader: ({ params }) => {
    const request = requests.find((r) => r.id === params.id);
    if (!request) throw notFound();
    return { request };
  },
  component: RequestDetail,
});

function RequestDetail() {
  const { request } = Route.useLoaderData();

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link to="/solicitacoes">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={request.numero}
        description={`${request.paciente.nome} · ${request.especialidade}`}
        actions={<StatusBadge status={request.status} className="px-3 py-1.5 text-sm" />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <PatientInfoCard patient={request.paciente} />

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Dados da consulta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <InfoField label="Especialidade" value={request.especialidade} />
                <InfoField label="Médico" value={`${request.medico} · ${request.crm}`} />
                <InfoField label="Tipo de consulta" value={request.tipoConsulta} />
                <InfoField label="Data desejada" value={request.dataDesejada} />
              </dl>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Observações
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {request.observacoes || "Sem observações registradas."}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader className="gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Stethoscope className="h-4 w-4 text-accent-foreground" /> Honorários médicos
                </CardTitle>
                <StatusBadge
                  status={request.honorariosMedicos === null ? "aguardando_medico" : "concluido"}
                  className="w-fit"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="honorarios">Valor dos honorários</Label>
                  <Input
                    id="honorarios"
                    placeholder="R$ 0,00"
                    defaultValue={
                      request.honorariosMedicos !== null
                        ? formatCurrency(request.honorariosMedicos)
                        : ""
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obs-medico">Observação do médico</Label>
                  <Textarea
                    id="obs-medico"
                    rows={3}
                    placeholder="Sem observações"
                    defaultValue={request.obsMedico}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4 text-accent-foreground" /> Valores hospitalares
                </CardTitle>
                <StatusBadge
                  status={request.valorHospitalar === null ? "aguardando_comercial" : "concluido"}
                  className="w-fit"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="hospitalar">Valor hospitalar</Label>
                  <Input
                    id="hospitalar"
                    placeholder="R$ 0,00"
                    defaultValue={
                      request.valorHospitalar !== null
                        ? formatCurrency(request.valorHospitalar)
                        : ""
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="obs-comercial">Observação do Comercial</Label>
                  <Textarea
                    id="obs-comercial"
                    rows={3}
                    placeholder="Sem observações"
                    defaultValue={request.obsComercial}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <FinancialSummary
            honorarios={request.honorariosMedicos}
            hospitalar={request.valorHospitalar}
          />

          <Card className="shadow-card">
            <CardHeader className="gap-2">
              <CardTitle className="text-base">Histórico</CardTitle>
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Representação inicial do fluxo
              </p>
            </CardHeader>
            <CardContent>
              <Timeline events={timelineEvents} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
