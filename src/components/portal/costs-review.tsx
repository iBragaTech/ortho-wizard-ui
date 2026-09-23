import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type ConsultationRequest, formatCurrency } from "@/data/mock";
import { portalCall } from "@/lib/data/local-api";
import { TasyProcedureSelect, type TasyProcedureItem } from "./tasy-procedure-select";
import { TasyMaterialSelect, type TasyMaterialItem } from "./tasy-material-select";
import { TasyOpmeSelect } from "./tasy-opme-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CostsReview({ request }: { request: ConsultationRequest }) {
  const pricing = request.precificacao;
  const selection = request.tasy;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [procedures, setProcedures] = useState<TasyProcedureItem[]>(
    () =>
      selection?.procedimentos.map((p) => ({
        ...p,
        nome:
          pricing?.referencia.itens.find((i) => i.codigo === p.codigo && i.origem === p.origem)
            ?.referencia.nome ?? p.codigo,
      })) ?? [],
  );
  const [materials, setMaterials] = useState<TasyMaterialItem[]>(
    () =>
      selection?.materiais.map((m) => ({
        ...m,
        grupo: null,
        nome:
          pricing?.referencia.itens.find((i) => i.tipo === "material" && i.codigo === m.codigo)
            ?.referencia.nome ?? m.codigo,
      })) ?? [],
  );
  const [opme, setOpme] = useState<TasyMaterialItem[]>([]);
  const [itemIndex, setItemIndex] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const cache = useQueryClient();
  async function save(operation: string, input: object) {
    setBusy(true);
    try {
      await portalCall(operation, { id: request.id, revisao: pricing?.revisao, ...input });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["requests"] }),
        cache.invalidateQueries({ queryKey: ["timeline", request.id] }),
      ]);
      setEditing(false);
      setItemIndex(null);
      setReason("");
      toast.success(
        operation === "approveRequest"
          ? "Orçamento aprovado. Documento liberado para o médico."
          : "Revisão registrada no histórico.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  if (!selection || !pricing || request.status === "concluido") return null;
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Revisão de Custos</h3>
      {request.honorariosSolicitados != null && (
        <p>Honorário solicitado pelo médico: {formatCurrency(request.honorariosSolicitados)}</p>
      )}
      <Button variant="outline" disabled={busy} onClick={() => setEditing(!editing)}>
        Revisar procedimentos, materiais e OPME
      </Button>
      {editing && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save("updateRequestItems", {
              motivo: reason,
              tasy: {
                ...selection,
                procedimentos: procedures.map(({ codigo, origem, quantidade = 1 }) => ({
                  codigo,
                  origem,
                  quantidade,
                })),
                materiais: [...materials, ...opme].map(({ codigo, quantidade = 1 }) => ({
                  codigo,
                  quantidade,
                })),
              },
            });
          }}
        >
          <p>Procedimentos (o primeiro é o principal)</p>
          <TasyProcedureSelect
            value={procedures}
            onChange={setProcedures}
            multiple
            cdConvenio={selection.cdConvenio}
            cdCategoria={selection.cdCategoria}
          />
          <p>Materiais e medicamentos selecionados (inclui OPME já solicitado)</p>
          <TasyMaterialSelect
            value={materials}
            onChange={setMaterials}
            cdConvenio={selection.cdConvenio}
            cdCategoria={selection.cdCategoria}
          />
          <p>Adicionar OPME</p>
          <TasyOpmeSelect
            value={opme}
            onChange={setOpme}
            cdConvenio={selection.cdConvenio}
            cdCategoria={selection.cdCategoria}
          />
          <label className="grid gap-2">
            Justificativa da revisão
            <Textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Salvar consulta novamente os preços hospitalares dos itens. Ajustes anteriores
            permanecem no histórico.
          </p>
          <Button disabled={busy || !procedures.length} type="submit">
            Salvar itens e recalcular
          </Button>
        </form>
      )}
      <div className="space-y-2">
        {pricing.referencia.itens.map((item, index) => (
          <div
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
            key={`${item.tipo}:${item.codigo}:${item.origem}`}
          >
            <span>{item.referencia.nome ?? item.codigo}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setItemIndex(index);
                setAmount(
                  String(item.referencia.valorMaterial ?? item.referencia.valorProcedimento ?? ""),
                );
                setReason("");
              }}
            >
              Ajustar valor do item
            </Button>
          </div>
        ))}
      </div>
      {itemIndex !== null && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save("adjustItemPrice", {
              indice: itemIndex,
              valor: Number(amount),
              motivo: reason,
            });
          }}
        >
          <label className="grid gap-2">
            Valor unitário (R$)
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="grid gap-2">
            Justificativa
            <Textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Salvar valor com auditoria
          </Button>
          <Button type="button" variant="ghost" onClick={() => setItemIndex(null)}>
            Cancelar
          </Button>
        </form>
      )}
      <Button
        disabled={busy || editing || itemIndex !== null || !pricing.referencia.completo}
        onClick={() => {
          if (
            window.confirm(
              "Aprovar e concluir este orçamento? Os valores serão liberados para impressão e a edição será encerrada.",
            )
          )
            void save("approveRequest", {});
        }}
      >
        Aprovar e concluir orçamento
      </Button>
    </section>
  );
}
