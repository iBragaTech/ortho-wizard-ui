import { useSession } from "@/lib/auth/session";
import { CostsReview } from "./costs-review";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type ConsultationRequest, formatCurrency } from "@/data/mock";
import { portalCall } from "@/lib/data/local-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function shortItemLabel(item: {
  tipo: string;
  codigo: string;
  referencia: { nome?: string };
}): string {
  const fallback = item.tipo === "material" ? "Material" : "Procedimento";
  const name = item.referencia.nome?.trim() || fallback;
  const shortened = name.length > 72 ? `${name.slice(0, 69).trimEnd()}...` : name;
  return `${shortened} - ${item.codigo}`;
}

export function BudgetPricing({ request }: { request: ConsultationRequest }) {
  const { user } = useSession();
  const canReview =
    ["Custos", "Administrador"].includes(user?.perfil ?? "") && request.status !== "concluido";
  const pricing = request.precificacao;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fees, setFees] = useState("");
  const [hospital, setHospital] = useState("");
  const [reason, setReason] = useState("");
  const [zeroItem, setZeroItem] = useState<{
    tipo: string;
    codigo: string;
    origem?: string;
  } | null>(null);
  const [zeroReason, setZeroReason] = useState("");
  const cache = useQueryClient();
  async function save(operation: string, input: unknown) {
    setBusy(true);
    try {
      await portalCall(operation, input);
      setEditing(false);
      setReason("");
      setZeroItem(null);
      setZeroReason("");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["requests"] }),
        cache.invalidateQueries({ queryKey: ["timeline", request.id] }),
      ]);
      toast.success("Valores e histórico atualizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  if (!canReview && request.status !== "concluido")
    return (
      <Card>
        <CardContent className="pt-6">
          Solicitação enviada para Custos. Os valores e a impressão serão liberados após a
          aprovação.
          {request.honorariosSolicitados != null && (
            <p className="mt-2">
              Honorário solicitado: {formatCurrency(request.honorariosSolicitados)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cálculo do orçamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pricing ? (
          <>
            <p>Busque os preços vigentes dos itens deste orçamento no Tasy.</p>
            <Button
              disabled={busy}
              onClick={() => void save("calculateRequest", { id: request.id })}
            >
              {busy ? "Calculando…" : "Calcular valores do Tasy"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Referência consultada em{" "}
              {new Date(pricing.referencia.calculadoEm).toLocaleString("pt-BR")} ·{" "}
              {pricing.referencia.nmUsuario}
            </p>
            <p className="text-sm">{pricing.referencia.contexto}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Item</th>
                    <th>Qtd.</th>
                    <th className="text-right">Valor unitário</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.referencia.itens.map((i) => (
                    <tr key={`${i.tipo}:${i.codigo}:${i.origem}`} className="border-t">
                      <td className="py-2">{shortItemLabel(i)}</td>
                      <td className="text-center">{i.quantidade}</td>
                      <td className="text-right">
                        {i.pendente
                          ? "Preço não confirmado"
                          : formatCurrency(
                              i.referencia.valorProcedimento ?? i.referencia.valorMaterial ?? null,
                            )}
                        {i.zeroConfirmado && (
                          <p className="text-xs">Zero confirmado com justificativa</p>
                        )}
                        {canReview &&
                          i.pendente &&
                          (i.tipo === "material"
                            ? i.referencia.valorMaterial === 0
                            : i.referencia.valorProcedimento === 0 &&
                              i.referencia.honorarios === 0) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                setZeroItem({
                                  tipo: i.tipo,
                                  codigo: i.codigo,
                                  ...(i.origem ? { origem: i.origem } : {}),
                                });
                                setZeroReason("");
                              }}
                            >
                              Confirmar valor zero
                            </Button>
                          )}
                      </td>
                      <td className="text-right">
                        {i.pendente
                          ? "Pendente"
                          : formatCurrency(
                              (Math.round(
                                (i.referencia.valorProcedimento ??
                                  i.referencia.valorMaterial ??
                                  0) * 100,
                              ) *
                                i.quantidade) /
                                100,
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {zeroItem && (
              <form
                className="space-y-3 rounded border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save("confirmZeroPrice", {
                    id: request.id,
                    revisao: pricing.revisao,
                    item: zeroItem,
                    motivo: zeroReason,
                  });
                }}
              >
                <p>
                  Confirmar {zeroItem.tipo} {zeroItem.codigo}
                  {zeroItem.origem ? ` · origem ${zeroItem.origem}` : ""} por{" "}
                  <strong>R$ 0,00</strong> neste orçamento. O item não acrescentará valor ao total.
                </p>
                <Label htmlFor="zero-reason">Justificativa obrigatória</Label>
                <Textarea
                  id="zero-reason"
                  required
                  minLength={5}
                  maxLength={1000}
                  value={zeroReason}
                  onChange={(e) => setZeroReason(e.target.value)}
                />
                <Button type="submit" disabled={busy || zeroReason.trim().length < 5}>
                  {busy ? "Salvando…" : "Confirmar zero com auditoria"}
                </Button>{" "}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setZeroItem(null)}
                >
                  Cancelar
                </Button>
              </form>
            )}
            {!pricing.referencia.completo ? (
              <>
                <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Há itens sem preço confirmado. Subtotal conhecido:{" "}
                  {formatCurrency(pricing.referencia.subtotalConfirmado)}. O total permanece
                  pendente até consultar os preços faltantes ou confirmar os itens com valor zero.
                </p>
                <Button
                  className={canReview ? undefined : "hidden"}
                  disabled={busy}
                  onClick={() => void save("calculateRequest", { id: request.id })}
                >
                  {busy ? "Consultando…" : "Consultar preços novamente"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Total de referência (inclui zeros confirmados):{" "}
                  <strong>{formatCurrency(pricing.referencia.total)}</strong>
                </p>
                <p className="text-sm">
                  Honorários atuais: {formatCurrency(request.honorariosMedicos)} · Hospitalar atual:{" "}
                  {formatCurrency(request.valorHospitalar)}
                </p>
                {!canReview ? null : !editing ? (
                  <Button
                    onClick={() => {
                      setFees(String(request.honorariosMedicos ?? ""));
                      setHospital(String(request.valorHospitalar ?? ""));
                      setEditing(true);
                    }}
                  >
                    Ajustar valores
                  </Button>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save("adjustPrices", {
                        id: request.id,
                        revisao: pricing.revisao,
                        honorarios: Number(fees),
                        hospitalar: Number(hospital),
                        motivo: reason,
                      });
                    }}
                  >
                    <div>
                      <Label htmlFor="adjust-fees">Honorários médicos (R$)</Label>
                      <Input
                        id="adjust-fees"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={fees}
                        onChange={(e) => setFees(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="adjust-hospital">Valor hospitalar (R$)</Label>
                      <Input
                        id="adjust-hospital"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={hospital}
                        onChange={(e) => setHospital(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="adjust-reason">Justificativa obrigatória</Label>
                      <Textarea
                        id="adjust-reason"
                        minLength={5}
                        maxLength={1000}
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                    <Button disabled={busy} type="submit">
                      {busy ? "Salvando…" : "Salvar ajuste com auditoria"}
                    </Button>{" "}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setEditing(false)}
                    >
                      Cancelar
                    </Button>
                  </form>
                )}
              </>
            )}
            {!!pricing.confirmacoesZero?.length && (
              <div className="space-y-3">
                <h3 className="font-medium">Confirmações de valor zero</h3>
                {pricing.confirmacoesZero.map((c, index) => (
                  <div key={index} className="rounded border p-3 text-sm">
                    <p>
                      {c.item.tipo} {c.item.codigo}
                      {c.item.origem ? ` · origem ${c.item.origem}` : ""} · R$ 0,00
                    </p>
                    <p>
                      {c.nomeUsuario}
                      {c.nmUsuario ? ` (${c.nmUsuario})` : ""} ·{" "}
                      {new Date(c.dataHora).toLocaleString("pt-BR")}
                    </p>
                    <p className="whitespace-pre-wrap">Justificativa: {c.motivo}</p>
                    <p className="text-xs">
                      Registrada na revisão {c.revisao}. Uma nova consulta exige nova confirmação.
                    </p>
                  </div>
                ))}
              </div>
            )}
            {pricing.ajustes.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Histórico de ajustes</h3>
                {pricing.ajustes.map((a, i) => (
                  <div key={i} className="rounded border p-3 text-sm">
                    <p>
                      {a.nomeUsuario} · {new Date(a.dataHora).toLocaleString("pt-BR")}
                    </p>
                    <p>
                      Honorários: {formatCurrency(a.anterior.honorarios)} →{" "}
                      {formatCurrency(a.novo.honorarios)}
                    </p>
                    <p>
                      Hospitalar: {formatCurrency(a.anterior.hospitalar)} →{" "}
                      {formatCurrency(a.novo.hospitalar)}
                    </p>
                    <p className="whitespace-pre-wrap">Justificativa: {a.motivo}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {canReview && <CostsReview key={pricing?.revisao} request={request} />}
      </CardContent>
    </Card>
  );
}
