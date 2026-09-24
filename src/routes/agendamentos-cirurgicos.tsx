import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { EmptyState } from "@/components/portal/empty-state";
import { NewSurgicalAppointmentDialog } from "@/components/portal/new-surgical-appointment-dialog";
import { PageHeader } from "@/components/portal/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/lib/auth/session";
import { useSurgicalAppointments } from "@/lib/data/hooks";
import {
  surgicalAppointmentStatusLabels,
  type SurgicalAppointmentStatus,
} from "@/data/surgical-appointments";

export const Route = createFileRoute("/agendamentos-cirurgicos")({
  head: () => ({
    meta: [
      { title: "Solicitações Cirúrgicas — Portal de Orçamentos" },
      {
        name: "description",
        content: "Solicitação e acompanhamento de datas para agendamentos cirúrgicos.",
      },
      { property: "og:title", content: "Solicitações Cirúrgicas — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Acompanhe solicitações de agendamento cirúrgico por médico e paciente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SurgicalAppointmentsPage,
});

function dateBr(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );
}

function createdDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function cpfBr(value: string) {
  return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function Status({ status }: { status: SurgicalAppointmentStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "confirmado"
          ? "border-success/30 bg-success-soft text-success"
          : status === "cancelado"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-warning/30 bg-warning-soft text-warning-foreground"
      }
    >
      {surgicalAppointmentStatusLabels[status]}
    </Badge>
  );
}

function SurgicalAppointmentsPage() {
  const { user } = useSession();
  const { data: appointments = [], isLoading, error } = useSurgicalAppointments();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const isDoctor = user?.perfil === "Médico";
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const digits = query.replace(/\D/g, "");
    return appointments.filter(
      (appointment) =>
        (status === "todos" || appointment.status === status) &&
        (!term ||
          appointment.patientName.toLocaleLowerCase("pt-BR").includes(term) ||
          (digits.length > 0 && appointment.patientCpf.includes(digits))),
    );
  }, [appointments, query, status]);

  return (
    <AppShell>
      <PageHeader
        title="Solicitações Cirúrgicas"
        description={
          isDoctor
            ? "Solicite uma data e acompanhe suas solicitações cirúrgicas."
            : "Acompanhe as solicitações de agendamento enviadas pelos médicos."
        }
        actions={
          isDoctor ? (
            <NewSurgicalAppointmentDialog
              trigger={
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" /> Novo agendamento
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar agendamento"
            placeholder="Buscar por paciente ou CPF..."
            value={query}
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrar situação" className="w-full">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="solicitado">Solicitado</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando agendamentos…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar os agendamentos.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={appointments.length ? "Nenhum agendamento encontrado" : "Nenhum agendamento solicitado"}
          description={
            appointments.length
              ? "Ajuste a busca ou a situação para visualizar outros resultados."
              : isDoctor
                ? "Use Novo agendamento para solicitar uma data de cirurgia."
                : "As solicitações enviadas pelos médicos aparecerão aqui."
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((appointment) => (
              <article key={appointment.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{appointment.patientName}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{cpfBr(appointment.patientCpf)}</p>
                  </div>
                  <Status status={appointment.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Data desejada</dt>
                    <dd className="mt-1 font-medium">{dateBr(appointment.desiredDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Médico</dt>
                    <dd className="mt-1 font-medium">{appointment.doctorName}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Paciente</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Médico solicitante</TableHead>
                  <TableHead>Data desejada</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">{appointment.patientName}</TableCell>
                    <TableCell className="text-muted-foreground">{cpfBr(appointment.patientCpf)}</TableCell>
                    <TableCell className="text-muted-foreground">{appointment.doctorName}</TableCell>
                    <TableCell className="font-medium">{dateBr(appointment.desiredDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{createdDate(appointment.createdAt)}</TableCell>
                    <TableCell><Status status={appointment.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  );
}