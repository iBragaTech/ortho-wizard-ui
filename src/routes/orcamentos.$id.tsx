import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Briefcase, Download, FileText, Info, Stethoscope } from "lucide-react";
import { toast } from "sonner";
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
import { formatCurrency, medicalFeesTotal } from "@/data/mock";
import { useRequest, useTimeline, useSettings } from "@/lib/data/hooks";
import { openQuoteDocument, downloadQuoteFile } from "@/lib/quote-document";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/orcamentos/$id")({
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
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const { data: request, isLoading } = useRequest(id);
  const { data: timelineEvents = [] } = useTimeline(id);
  const { data: settings } = useSettings();

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando orçamento...</p>
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Orçamento não encontrado.</p>
      </AppShell>
    );
  }

  const institution = settings ?? {
    nome: "",
    cnpj: "",
    endereco: "",
    telefone: "",
    emailNotificacoes: "",
  };

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link to="/orcamentos">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={request.numero}
        description={`${request.paciente.nome} · ${request.especialidade}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} className="px-3 py-1.5 text-sm" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <FileText className="h-4 w-4" /> Gerar arquivo do paciente
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    const ok = openQuoteDocument(request, institution);
                    if (!ok) toast.error("Permita pop-ups para abrir o documento.");
                  }}
                >
                  <FileText className="h-4 w-4" /> Visualizar / Salvar em PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    downloadQuoteFile(request, institution);
                    toast.success("Arquivo do orçamento baixado.");
                  }}
                >
                  <Download className="h-4 w-4" /> Baixar arquivo para enviar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="honorarios">Honorário</Label>
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
                    <Label htmlFor="diaria">Diária</Label>
                    <Input
                      id="diaria"
                      placeholder="R$ 0,00"
                      defaultValue={request.diaria !== null ? formatCurrency(request.diaria) : ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cti">CTI</Label>
                    <Input
                      id="cti"
                      placeholder="R$ 0,00"
                      defaultValue={request.cti !== null ? formatCurrency(request.cti) : ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fisioterapia">Fisioterapia (quantidade)</Label>
                    <Input
                      id="fisioterapia"
                      type="number"
                      placeholder="Ex.: 4"
                      defaultValue={request.fisioterapia !== null ? String(request.fisioterapia) : ""}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="tempo-bloco">Tempo de bloco</Label>
                    <Input
                      id="tempo-bloco"
                      placeholder="Ex.: 2h30"
                      defaultValue={request.tempoBloco}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="opme">OPME (descrição detalhada do item, quantidade e fornecedor)</Label>
                  <Textarea
                    id="opme"
                    rows={2}
                    placeholder="Sem informações"
                    defaultValue={request.opme}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="anatomo">Anatomo Patológico</Label>
                  <Textarea
                    id="anatomo"
                    rows={2}
                    placeholder="Sem informações"
                    defaultValue={request.anatomoPatologico}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sangue">Reserva de sangue (material e quantidade)</Label>
                  <Textarea
                    id="sangue"
                    rows={2}
                    placeholder="Sem informações"
                    defaultValue={request.reservaSangue}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="equipe">Equipe multidisciplinar</Label>
                  <Textarea
                    id="equipe"
                    rows={2}
                    placeholder="Sem informações"
                    defaultValue={request.equipeMultidisciplinar}
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
            honorarios={medicalFeesTotal(request)}
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
