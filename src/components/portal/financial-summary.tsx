import { formatCurrency } from "@/data/mock";

export function FinancialSummary({
  honorarios,
  hospitalar,
  tasyTotal,
}: {
  honorarios: number | null;
  hospitalar: number | null;
  tasyTotal?: number | null | undefined;
}) {
  const total =
    tasyTotal !== undefined
      ? tasyTotal
      : honorarios === null || hospitalar === null
        ? null
        : (honorarios ?? 0) + (hospitalar ?? 0);

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary-soft/60 shadow-card">
      <div className="border-b border-primary/15 px-5 py-4">
        <h2 className="text-sm font-semibold text-accent-foreground">Resumo financeiro</h2>
        <p className="text-xs text-muted-foreground">Valores registrados no orçamento</p>
      </div>
      <dl className="divide-y divide-primary/10 px-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3">
          <dt className="text-sm text-muted-foreground">
            {tasyTotal !== undefined
              ? "Valor médico registrado (informativo)"
              : "Honorários médicos"}
          </dt>
          <dd className="text-sm font-medium text-foreground">{formatCurrency(honorarios)}</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3">
          <dt className="text-sm text-muted-foreground">
            {tasyTotal !== undefined ? "Orçamento no Tasy" : "Valor hospitalar"}
          </dt>
          <dd className="text-sm font-medium text-foreground">{formatCurrency(hospitalar)}</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
          <dt className="text-sm font-semibold text-foreground">Valor total</dt>
          <dd className="text-xl font-semibold tracking-tight text-accent-foreground">
            {formatCurrency(total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
