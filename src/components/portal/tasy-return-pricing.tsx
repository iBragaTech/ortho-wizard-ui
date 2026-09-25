import { type ConsultationRequest, formatCurrency } from "@/data/mock";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function TasyReturnPricing({ request }: { request: ConsultationRequest }) {
  const data = request.tasyRetorno;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Orçamento no Tasy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>Custos ajusta os itens e valores no Tasy. A Tesouraria registra o pagamento.</p>
        {data?.consultadoEm && (
          <p className="text-sm text-muted-foreground">
            Última consulta: {new Date(data.consultadoEm).toLocaleString("pt-BR")}
          </p>
        )}
        {data?.erro ? (
          <p role="alert">{data.erro} Os dados exibidos são da última sincronização concluída.</p>
        ) : (
          !data?.id && <p>Aguardando sincronização com o Tasy.</p>
        )}
        {data?.statusCode === 2 && !data.receipt && (
          <p role="status">
            O Tasy indica aprovação, mas o comprovante de pagamento ainda não foi identificado. A
            aprovação no portal está pendente.
          </p>
        )}
        {data?.itens?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Item</th>
                  <th>Quantidade</th>
                  <th className="text-right">Valor do item no Tasy</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((i) => (
                  <tr className="border-t" key={`${i.tipo}:${i.id}`}>
                    <td className="py-2">
                      {i.descricao || i.codigo}
                      {!i.contabilizado && " (informativo)"}
                    </td>
                    <td className="text-center">{i.quantidade}</td>
                    <td className="text-right">{formatCurrency(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 font-medium">
              Total com descontos e ajustes do Tasy: {formatCurrency(data.total ?? null)}
            </p>
          </div>
        ) : (
          <p>Os valores e o PDF estarão disponíveis após a revisão de Custos, em “Em aprovação”.</p>
        )}
      </CardContent>
    </Card>
  );
}
