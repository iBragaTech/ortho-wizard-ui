import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { formatCurrency, totalOf, type ConsultationRequest } from "@/data/mock";

export function RequestCard({ request }: { request: ConsultationRequest }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{request.numero}</p>
          <p className="truncate text-sm font-semibold text-foreground">
            {request.paciente.nome}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2">
          <Stethoscope className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {request.medico} · {request.especialidade}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {request.data}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="truncate text-sm font-semibold text-foreground">
            {formatCurrency(totalOf(request))}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/solicitacoes/$id" params={{ id: request.id }}>
            Visualizar <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
