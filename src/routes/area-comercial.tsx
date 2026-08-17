import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, CheckCircle2, Search } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { MetricCard } from "@/components/portal/metric-card";
import { StatusBadge } from "@/components/portal/status-badge";
import { FinancialSummary } from "@/components/portal/financial-summary";
import { InfoField } from "@/components/portal/patient-info-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, medicalFeesTotal, requests } from "@/data/mock";

export const Route = createFileRoute("/area-comercial")({
  head: () => ({
    meta: [
      { title: "Área Comercial — Portal de Orçamentos" },
      {
        name: "description",
        content: "Espaço do setor Comercial para preencher valores hospitalares e consolidar orçamentos.",
      },
      { property: "og:title", content: "Área Comercial — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Analise solicitações, informe valores hospitalares e finalize orçamentos.",
      },
    ],
  }),
  component: AreaComercial,
});

function AreaComercial() {
  const fila = requests.filter((r) => r.status !== "concluido");
  const [selectedId, setSelectedId] = useState(fila[0]?.id ?? requests[0]?.id ?? "");
  const selected = requests.find((r) => r.id === selectedId) ?? requests[0]!;


  const emAnalise = requests.filter((r) => r.status === "em_analise" || r.status === "pendente");
  const aguardando = requests.filter((r) => r.status === "aguardando_comercial");
  const concluidos = requests.filter((r) => r.status === "concluido");

  const medicoPreenchido = selected.honorariosMedicos !== null;

  return (
    <AppShell>
      <PageHeader
        title="Área Comercial"
        description="Analise as solicitações e informe os valores hospitalares do orçamento."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Aguardando análise" value={emAnalise.length} icon={Search} />
        <MetricCard
          label="Aguardando valor hospitalar"
          value={aguardando.length}
          icon={Briefcase}
          tone="warning"
        />
        <MetricCard label="Orçamentos concluídos" value={concluidos.length} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Solicitações na fila</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fila.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  r.id === selectedId
                    ? "border-primary/40 bg-primary-soft"
                    : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{r.numero}</p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.paciente.nome}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.especialidade}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{selected.numero}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <InfoField label="Paciente" value={selected.paciente.nome} />
                <InfoField label="CPF" value={selected.paciente.cpf} />
                <InfoField label="Médico" value={selected.medico} />
                <InfoField label="Especialidade" value={selected.especialidade} />
                <InfoField label="Tipo de consulta" value={selected.tipoConsulta} />
                <InfoField label="Data desejada" value={selected.dataDesejada} />
                <InfoField
                  label="Total médico"
                  value={formatCurrency(medicalFeesTotal(selected))}
                />
                <InfoField
                  label="Status do médico"
                  value={medicoPreenchido ? "Preenchido" : "Aguardando médico"}
                />
              </dl>

              {medicoPreenchido ? (
                <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Detalhamento médico
                  </p>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InfoField label="Honorário" value={formatCurrency(selected.honorariosMedicos)} />
                    <InfoField label="Diária" value={formatCurrency(selected.diaria)} />
                    <InfoField label="CTI" value={formatCurrency(selected.cti)} />
                    <InfoField label="Fisioterapia" value={selected.fisioterapia !== null ? `${selected.fisioterapia} sessões` : "—"} />
                    <InfoField label="Tempo de bloco" value={selected.tempoBloco || "—"} />
                    <InfoField label="OPME" value={selected.opme || "—"} />
                    <InfoField label="Anatomo Patológico" value={selected.anatomoPatologico || "—"} />
                    <InfoField label="Reserva de sangue" value={selected.reservaSangue || "—"} />
                    <InfoField label="Equipe multidisciplinar" value={selected.equipeMultidisciplinar || "—"} />
                  </dl>
                  {selected.obsMedico ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Observação do médico</p>
                      <p className="mt-1 text-sm text-foreground">{selected.obsMedico}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Preenchimento do Comercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="valor-hospitalar">Valor hospitalar</Label>
                <Input
                  id="valor-hospitalar"
                  placeholder="R$ 0,00"
                  defaultValue={
                    selected.valorHospitalar !== null
                      ? formatCurrency(selected.valorHospitalar)
                      : ""
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="obs-com">Observação</Label>
                <Textarea
                  id="obs-com"
                  rows={3}
                  placeholder="Taxas, materiais e demais informações"
                  defaultValue={selected.obsComercial}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="w-full sm:w-auto">
                  Salvar rascunho
                </Button>
                <Button className="w-full sm:w-auto">Concluir orçamento</Button>
              </div>
            </CardContent>
          </Card>

          <FinancialSummary
            honorarios={medicalFeesTotal(selected)}
            hospitalar={selected.valorHospitalar}
          />
        </div>
      </div>
    </AppShell>
  );
}
