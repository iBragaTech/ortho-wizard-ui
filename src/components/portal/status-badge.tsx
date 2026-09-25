import { cn } from "@/lib/utils";
import { statusLabels, type RequestStatus } from "@/data/mock";

const styles: Record<RequestStatus, string> = {
  pendente: "bg-muted text-muted-foreground ring-border",
  em_analise: "bg-primary-soft text-accent-foreground ring-primary/20",
  aguardando_medico: "bg-warning-soft text-warning-foreground ring-warning/30",
  aguardando_comercial: "bg-primary-soft text-accent-foreground ring-primary/25",
  concluido: "bg-success-soft text-success ring-success/25",
  aguardando_cotacao: "bg-primary-soft text-accent-foreground ring-primary/20",
  em_aprovacao: "bg-warning-soft text-warning-foreground ring-warning/30",
  aguardando_pagamento: "bg-warning-soft text-warning-foreground ring-warning/30",
  aguardando_documentacao: "bg-warning-soft text-warning-foreground ring-warning/30",
  cancelado_paciente: "bg-muted text-muted-foreground ring-border",
  cancelado_estabelecimento: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: RequestStatus;
  className?: string;
  label?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        styles[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label || statusLabels[status]}
    </span>
  );
}
