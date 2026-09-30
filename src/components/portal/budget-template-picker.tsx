import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { portalCall } from "@/lib/data/local-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TasyProcedureItem } from "./tasy-procedure-select";
import type { TasyMaterialItem } from "./tasy-material-select";
import type { TasyOpmeItem } from "./tasy-opme-select";

export type BudgetTemplateData = {
  cdConvenio: string;
  cdCategoria: string;
  procedimento: TasyProcedureItem[];
  adicionais: TasyProcedureItem[];
  materiais: TasyMaterialItem[];
  opme: TasyOpmeItem[];
};
type Template = { id: string; nome: string; dados: BudgetTemplateData };

export function BudgetTemplatePicker({
  userId,
  value,
  onLoad,
}: {
  userId: string;
  value: BudgetTemplateData;
  onLoad: (data: BudgetTemplateData) => void;
}) {
  const cache = useQueryClient();
  const queryKey = ["budget-templates", userId];
  const templates = useQuery({
    queryKey,
    queryFn: () => portalCall<Template[]>("listBudgetTemplates"),
    retry: false,
  });
  const [selected, setSelected] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = templates.data?.find((item) => item.id === selected);
  const compatible = (item: Template) =>
    item.dados.cdConvenio === value.cdConvenio && item.dados.cdCategoria === value.cdCategoria;
  const canSave = !!value.cdConvenio && !!value.cdCategoria && value.procedimento.length === 1;

  async function save() {
    setBusy(true);
    try {
      const normalize = <T extends { quantidade?: number }>(items: T[]) =>
        items.map((item) => ({ ...item, quantidade: item.quantidade ?? 1 }));
      const saved = await portalCall<Template>("saveBudgetTemplate", {
        nome: name.trim(),
        dados: {
          ...value,
          procedimento: normalize(value.procedimento),
          adicionais: normalize(value.adicionais),
          materiais: normalize(value.materiais),
          opme: normalize(value.opme),
        },
      });
      await cache.invalidateQueries({ queryKey });
      setSelected(saved.id);
      setNaming(false);
      setName("");
      toast.success(`Modelo “${saved.nome}” salvo nos seus favoritos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o modelo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!current) return;
    setBusy(true);
    try {
      await portalCall("deleteBudgetTemplate", { id: current.id });
      await cache.invalidateQueries({ queryKey });
      setSelected("");
      setConfirmDelete(false);
      toast.success("Modelo removido dos favoritos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o modelo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="budget-template" className="flex items-center gap-2">
          <Star className="size-4 text-amber-500" aria-hidden="true" /> Meus modelos favoritos
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canSave || busy}
          onClick={() => {
            setNaming(true);
            setConfirmDelete(false);
          }}
        >
          <Star className="mr-2 size-4" aria-hidden="true" /> Salvar como modelo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Somente você tem acesso. Salva procedimentos, materiais e OPME com suas quantidades, sem
        dados do paciente ou preços. Selecione a categoria do convênio para carregar um modelo
        compatível.
      </p>
      {templates.isError ? (
        <div role="alert" className="text-sm">
          Não foi possível carregar seus modelos.
          <Button type="button" variant="link" onClick={() => void templates.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <select
            id="budget-template"
            className="min-w-0 flex-1 rounded-md border bg-background p-2 text-sm"
            value={selected}
            disabled={templates.isPending || busy}
            onChange={(event) => {
              setSelected(event.target.value);
              setConfirmDelete(false);
            }}
          >
            <option value="">
              {templates.isPending
                ? "Carregando modelos…"
                : templates.data?.length
                  ? "Selecione um modelo"
                  : "Nenhum modelo salvo"}
            </option>
            {templates.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
                {compatible(item) ? "" : ` — categoria ${item.dados.cdCategoria}`}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={!current || !compatible(current) || busy}
            onClick={() => {
              if (!current || !compatible(current)) return;
              onLoad(structuredClone(current.dados));
              toast.success(`Modelo “${current.nome}” carregado. Revise os itens antes de enviar.`);
            }}
          >
            Carregar modelo
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(true);
                setNaming(false);
              }}
            >
              Excluir modelo
            </Button>
          )}
        </div>
      )}
      {current && (
        <p className="text-xs text-muted-foreground">
          {current.dados.procedimento[0]?.nome} · {current.dados.materiais.length} materiais ·{" "}
          {current.dados.opme.length} OPMEs.
          {compatible(current)
            ? " Carregar substitui os procedimentos, materiais e OPME selecionados neste formulário."
            : " Selecione a mesma categoria do convênio para usar este modelo."}
        </p>
      )}
      {confirmDelete && current && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Excluir “{current.nome}” dos seus favoritos?
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void remove()}
          >
            Confirmar exclusão
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            Cancelar
          </Button>
        </div>
      )}
      {naming && (
        <div className="grid gap-2">
          <Label htmlFor="budget-template-name">Nome do modelo</Label>
          <Input
            id="budget-template-name"
            placeholder="Ex.: Implante de Cateter"
            maxLength={120}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!name.trim() || !canSave || busy}
              onClick={() => void save()}
            >
              {busy ? "Salvando…" : "Salvar favorito"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setNaming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
