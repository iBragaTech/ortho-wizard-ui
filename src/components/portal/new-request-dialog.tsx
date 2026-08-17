import type { ReactNode } from "react";
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

type Field = {
  id: string;
  label: string;
  placeholder: string;
  type?: string;
  full?: boolean;
  multiline?: boolean;
};

const dadosPaciente: Field[] = [
  { id: "nome", label: "Nome completo", placeholder: "Nome completo do paciente", full: true },
  { id: "nascimento", label: "Data de nascimento", placeholder: "dd/mm/aaaa", type: "date" },
  { id: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { id: "telefone", label: "Telefone", placeholder: "(00) 00000-0000" },
  { id: "procedimento", label: "Código do procedimento", placeholder: "Ex.: 3.10.01.012-3" },
];

const dadosProcedimento: Field[] = [
  { id: "diaria-enf", label: "Diária Enf / Ap", placeholder: "Quantidade de diárias" },
  { id: "diaria-cti", label: "Diária CTI", placeholder: "Quantidade de diárias" },
  { id: "opme", label: "OPME", placeholder: "Materiais e órteses previstos", full: true, multiline: true },
  {
    id: "anamoto",
    label: "Anamoto patológico",
    placeholder: "Descrição do anamoto patológico",
    full: true,
    multiline: true,
  },
  { id: "sangue", label: "Reserva de sangue", placeholder: "Ex.: 2 concentrados de hemácias" },
  {
    id: "multidisciplinar",
    label: "Equipe multidisciplinar/Fisioterapia",
    placeholder: "Ex.: Fisioterapia 2x/dia",
  },
  { id: "bloco", label: "Tempo de bloco", placeholder: "Ex.: 2h30" },
];

function FieldGroup({ fields }: { fields: Field[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.id} className={`grid gap-2 ${f.full ? "sm:col-span-2" : ""}`}>
          <Label htmlFor={f.id}>{f.label}</Label>
          {f.multiline ? (
            <Textarea id={f.id} placeholder={f.placeholder} rows={2} />
          ) : (
            <Input id={f.id} type={f.type ?? "text"} placeholder={f.placeholder} />
          )}
        </div>
      ))}
    </div>
  );
}

export function NewRequestDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription>
            Formulário demonstrativo — nesta etapa os dados não são salvos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do paciente
            </h3>
            <FieldGroup fields={dadosPaciente} />
          </section>

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do procedimento
            </h3>
            <FieldGroup fields={dadosProcedimento} />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline">Cancelar</Button>
          <Button>Criar orçamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
