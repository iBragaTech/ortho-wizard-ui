import { useQuery } from "@tanstack/react-query";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/data/mock";

type Price = {
  valorProcedimento: number | null;
  honorarios: number | null;
  custoOperacional: number | null;
  filmeMateriais: number | null;
  consultadoEm: string;
  contexto: string;
};
export function TasyPriceReference({
  codigo,
  origem,
  cdConvenio,
  cdCategoria,
}: {
  codigo: string;
  origem: string;
  cdConvenio: string;
  cdCategoria: string;
}) {
  const query = useQuery({
    queryKey: ["tasy-price", cdConvenio, cdCategoria, codigo, origem],
    enabled: false,
    retry: false,
    staleTime: 0,
    queryFn: () =>
      getTasyClient().executeOperation<Price>("precos.procedimento", {
        codigo,
        origem,
        cdConvenio,
        cdCategoria,
      }),
  });
  const p = query.data;
  const show = (value: number | null) => (value === null ? "Não informado" : formatCurrency(value));
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        {query.isFetching ? "Consultando valores…" : "Consultar valores no Tasy"}
      </Button>
      {query.error && <p role="alert">{query.error.message}</p>}
      {!query.isFetching && !query.error && p && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <dt>Procedimento (unitário)</dt>
            <dd>{show(p.valorProcedimento)}</dd>
            <dt>Honorários (médico, anestesista e auxiliares)</dt>
            <dd>{show(p.honorarios)}</dd>
            <dt>Custo operacional</dt>
            <dd>{show(p.custoOperacional)}</dd>
            <dt>Filme/materiais da tabela</dt>
            <dd>{show(p.filmeMateriais)}</dd>
          </dl>
          {(p.valorProcedimento === null || p.valorProcedimento <= 0) && (
            <p role="status">
              O Tasy não retornou valor positivo para este contexto. Confira a tabela e as condições
              do atendimento; não considere este resultado uma cotação gratuita.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Consulta: {p.consultadoEm.replace("T", " ")} (horário do Oracle). {p.contexto} As
            parcelas não devem ser somadas novamente ao valor do procedimento.
          </p>
        </>
      )}
    </div>
  );
}
