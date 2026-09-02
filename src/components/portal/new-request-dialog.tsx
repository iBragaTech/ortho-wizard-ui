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
import { useCreateRequest } from "@/lib/data/hooks";
import { OpmeSelect, formatOpmeSelection } from "@/components/portal/opme-select";

const empty = {
  nome: "",
  nascimento: "",
  cpf: "",
  telefone: "",
  procedimento: "",
  diariaEnf: "",
  diariaCti: "",
  anatomo: "",
  sangue: "",
  multidisciplinar: "",
  bloco: "",
};

export function NewRequestDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [opme, setOpme] = useState<string[]>([]);
  const create = useCreateRequest();

  const set = (key: keyof typeof empty) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!form.nome.trim() || !form.cpf.trim()) {
      toast.error("Informe ao menos nome e CPF do paciente.");
      return;
    }
    const observacoes = [
      form.procedimento && `Código do procedimento: ${form.procedimento}`,
      form.diariaEnf && `Diária Enf/Ap: ${form.diariaEnf}`,
      form.diariaCti && `Diária CTI: ${form.diariaCti}`,
      opme.length > 0 && `OPME: ${formatOpmeSelection(opme)}`,
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
        observacoes,
      });
      toast.success("Orçamento criado e enviado ao médico.");
      setForm(empty);
      setOpme([]);
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
            Os dados são salvos no banco e o orçamento segue para preenchimento do médico.
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
              <div className="grid gap-2">
                <Label htmlFor="procedimento">Código do procedimento</Label>
                <Input
                  id="procedimento"
                  placeholder="Ex.: 3.10.01.012-3"
                  value={form.procedimento}
                  onChange={(e) => set("procedimento")(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Dados do procedimento
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="grid gap-2 sm:col-span-2">
                <Label>OPME</Label>
                <OpmeSelect value={opme} onChange={setOpme} />
                <p className="text-xs text-muted-foreground">
                  Catálogo demonstrativo — será substituído pela tabela de OPME do banco corporativo.
                </p>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="anamoto">Anamoto patológico</Label>
                <Textarea
                  id="anamoto"
                  rows={2}
                  placeholder="Descrição do anamoto patológico"
                  value={form.anatomo}
                  onChange={(e) => set("anatomo")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sangue">Reserva de sangue</Label>
                <Input
                  id="sangue"
                  placeholder="Ex.: 2 concentrados de hemácias"
                  value={form.sangue}
                  onChange={(e) => set("sangue")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="multidisciplinar">Equipe multidisciplinar/Fisioterapia</Label>
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
            </div>
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
