import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONVENIO_CATEGORIAS } from "@/data/convenio-catalog";
import { useCreateRequest } from "@/lib/data/hooks";
import { OpmeSelect, formatOpmeSelection } from "@/components/portal/opme-select";
import { ProcedureSelect } from "@/components/portal/procedure-select";
import { formatProcedure, formatProcedureSelection } from "@/data/procedure-catalog";

const empty = {
  nome: "",
  nascimento: "",
  cpf: "",
  telefone: "",
  categoriaConvenio: "",
  // Campos do Comercial
  diariaEnf: "",
  diariaCti: "",
  anatomo: "",
  sangue: "",
  multidisciplinar: "",
  bloco: "",
  // Campos do Médico
  honorario: "",
  diaria: "",
  cti: "",
  fisioterapia: "",
  obsMedico: "",
};

function toNumber(value: string): number | null {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

export function NewRequestDialog({
  trigger,
  origem = "comercial",
}: {
  trigger: ReactNode;
  origem?: "comercial" | "medico";
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [opme, setOpme] = useState<string[]>([]);
  const [procedimento, setProcedimento] = useState<string[]>([]);
  const [adicionais, setAdicionais] = useState<string[]>([]);
  const create = useCreateRequest();
  const isMedico = origem === "medico";

  const set = (key: keyof typeof empty) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!form.nome.trim() || !form.cpf.trim()) {
      toast.error("Informe ao menos nome e CPF do paciente.");
      return;
    }

    const opmeTexto = opme.length > 0 ? formatOpmeSelection(opme) : "";
    const principalTexto = procedimento[0] ? formatProcedure(procedimento[0]) : "";
    const adicionaisTexto = adicionais.length > 0 ? formatProcedureSelection(adicionais) : "";

    const observacoes = isMedico
      ? [
          principalTexto && `Procedimento principal: ${principalTexto}`,
          adicionaisTexto && `Procedimentos adicionais: ${adicionaisTexto}`,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          principalTexto && `Procedimento principal: ${principalTexto}`,
          adicionaisTexto && `Procedimentos adicionais: ${adicionaisTexto}`,
          form.diariaEnf && `Diária Enf/Ap: ${form.diariaEnf}`,
          form.diariaCti && `Diária CTI: ${form.diariaCti}`,
          opmeTexto && `OPME: ${opmeTexto}`,
          form.anatomo && `Anatomo patológico: ${form.anatomo}`,
          form.sangue && `Reserva de sangue: ${form.sangue}`,
          form.multidisciplinar && `Equipe multidisciplinar/Fisioterapia: ${form.multidisciplinar}`,
          form.bloco && `Tempo de bloco: ${form.bloco}`,
        ]
          .filter(Boolean)
          .join("\n");

    try {
      await create.mutateAsync({
        nome: form.nome.trim(),
        nascimento: form.nascimento,
        cpf: form.cpf.trim(),
        telefone: form.telefone.trim(),
        especialidade: principalTexto,
        observacoes,
        origem,
        ...(isMedico
          ? {
              medico: {
                honorariosMedicos: toNumber(form.honorario),
                diaria: toNumber(form.diaria),
                cti: toNumber(form.cti),
                opme: opmeTexto,
                anatomoPatologico: form.anatomo,
                reservaSangue: form.sangue,
                equipeMultidisciplinar: form.multidisciplinar,
                fisioterapia: toNumber(form.fisioterapia),
                tempoBloco: form.bloco,
                obsMedico: form.obsMedico,
              },
            }
          : {}),
      });
      toast.success(
        isMedico
          ? "Orçamento criado e enviado ao Comercial."
          : "Orçamento criado e enviado ao médico.",
      );
      setForm(empty);
      setOpme([]);
      setProcedimento([]);
      setAdicionais([]);

      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o orçamento.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription>
            {isMedico
              ? "Preencha os dados médicos. O orçamento segue para o Comercial completar os valores hospitalares."
              : "Os dados são salvos no banco e o orçamento segue para preenchimento do médico."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Dados do paciente
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  placeholder="Nome completo do paciente"
                  value={form.nome}
                  onChange={(e) => set("nome")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nascimento">Data de nascimento</Label>
                <Input
                  id="nascimento"
                  type="date"
                  value={form.nascimento}
                  onChange={(e) => set("nascimento")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => set("cpf")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => set("telefone")(e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Procedimento principal</Label>
                <ProcedureSelect
                  value={procedimento}
                  onChange={setProcedimento}
                  placeholder="Pesquisar procedimento principal..."
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Procedimentos adicionais</Label>
                <ProcedureSelect
                  value={adicionais}
                  onChange={setAdicionais}
                  multiple
                  placeholder="Pesquisar procedimentos adicionais..."
                />
                <p className="text-xs text-muted-foreground">
                  Catálogo demonstrativo — será substituído pela tabela de procedimentos do banco
                  corporativo.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {isMedico ? "Dados médicos" : "Dados do procedimento"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {isMedico ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="honorario">Honorário (R$)</Label>
                    <Input
                      id="honorario"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.honorario}
                      onChange={(e) => set("honorario")(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="diaria">Diária (R$)</Label>
                    <Input
                      id="diaria"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.diaria}
                      onChange={(e) => set("diaria")(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cti">CTI (R$)</Label>
                    <Input
                      id="cti"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.cti}
                      onChange={(e) => set("cti")(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fisioterapia">Fisioterapia (quantidade)</Label>
                    <Input
                      id="fisioterapia"
                      inputMode="numeric"
                      placeholder="Ex.: 10"
                      value={form.fisioterapia}
                      onChange={(e) => set("fisioterapia")(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="diaria-enf">Diária Enf / Ap</Label>
                    <Input
                      id="diaria-enf"
                      placeholder="Quantidade de diárias"
                      value={form.diariaEnf}
                      onChange={(e) => set("diariaEnf")(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="diaria-cti">Diária CTI</Label>
                    <Input
                      id="diaria-cti"
                      placeholder="Quantidade de diárias"
                      value={form.diariaCti}
                      onChange={(e) => set("diariaCti")(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="grid gap-2 sm:col-span-2">
                <Label>OPME{isMedico ? " (item, quantidade e fornecedor)" : ""}</Label>
                <OpmeSelect value={opme} onChange={setOpme} />
                <p className="text-xs text-muted-foreground">
                  Catálogo demonstrativo — será substituído pela tabela de OPME do banco corporativo.
                </p>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="anamoto">{isMedico ? "Anatomo Patológico" : "Anamoto patológico"}</Label>
                <Textarea
                  id="anamoto"
                  rows={2}
                  placeholder="Descrição"
                  value={form.anatomo}
                  onChange={(e) => set("anatomo")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sangue">
                  {isMedico ? "Reserva de sangue (material e quantidade)" : "Reserva de sangue"}
                </Label>
                <Input
                  id="sangue"
                  placeholder="Ex.: 2 concentrados de hemácias"
                  value={form.sangue}
                  onChange={(e) => set("sangue")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="multidisciplinar">
                  {isMedico ? "Equipe multidisciplinar" : "Equipe multidisciplinar/Fisioterapia"}
                </Label>
                <Input
                  id="multidisciplinar"
                  placeholder="Ex.: Fisioterapia 2x/dia"
                  value={form.multidisciplinar}
                  onChange={(e) => set("multidisciplinar")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bloco">Tempo de bloco</Label>
                <Input
                  id="bloco"
                  placeholder="Ex.: 2h30"
                  value={form.bloco}
                  onChange={(e) => set("bloco")(e.target.value)}
                />
              </div>

              {isMedico ? (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="obs-medico">Observações do médico</Label>
                  <Textarea
                    id="obs-medico"
                    rows={2}
                    placeholder="Informações adicionais para o Comercial"
                    value={form.obsMedico}
                    onChange={(e) => set("obsMedico")(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending
              ? "Salvando..."
              : isMedico
                ? "Criar e enviar ao Comercial"
                : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
