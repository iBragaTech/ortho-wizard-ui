import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "./tag-input";
import { ProcedureSelect } from "./procedure-select";
import { RequiredMark } from "./item-quantity";
import { useCreateSurgicalAppointment } from "@/lib/data/hooks";
import { useSession } from "@/lib/auth/session";
import { isValidCpf } from "@/lib/data/tasy";
import {
  emptySurgicalRequestDetails,
  type SurgicalMaterialItem,
  type SurgicalRequestDetails,
} from "@/data/surgical-appointments";
import {
  anestesiaOptions,
  anatomiaPatologicaOptions,
  equipamentosOptions,
  lateralidadeOptions,
  movimentoPacienteOptions,
  origemPacienteOptions,
  porteCirurgiaOptions,
  regimeInternacaoOptions,
  tipoCirurgiaOptions,
} from "@/data/surgical-request-catalogs";

type FormState = SurgicalRequestDetails & { patientName: string; patientCpf: string };

const initialForm: FormState = {
  patientName: "",
  patientCpf: "",
  ...emptySurgicalRequestDetails,
};

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function nowLocal(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toInt(value: string): number | null {
  if (value === "") return null;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="border-b border-border pb-1 text-sm font-semibold">{children}</h4>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: ReactNode;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={typeof label === "string" ? label : undefined}>
          <SelectValue placeholder={placeholder ?? "Selecione…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function YesNoField({
  label,
  name,
  value,
  onChange,
}: {
  label: ReactNode;
  name: string;
  value: "" | "sim" | "nao";
  onChange: (value: "" | "sim" | "nao") => void;
}) {
  return (
    <Field label={label}>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as "" | "sim" | "nao")}
        className="flex items-center gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sim" id={`${name}-sim`} />
          <Label htmlFor={`${name}-sim`} className="font-normal">
            Sim
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="nao" id={`${name}-nao`} />
          <Label htmlFor={`${name}-nao`} className="font-normal">
            Não
          </Label>
        </div>
      </RadioGroup>
    </Field>
  );
}

function MaterialRows({
  items,
  onChange,
  materialLabel,
}: {
  items: SurgicalMaterialItem[];
  onChange: (items: SurgicalMaterialItem[]) => void;
  materialLabel: string;
}) {
  function update(index: number, patch: Partial<SurgicalMaterialItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-3"
        >
          <Input
            aria-label={`${materialLabel} ${index + 1}`}
            placeholder={materialLabel}
            value={item.material}
            maxLength={120}
            onChange={(e) => update(index, { material: e.target.value })}
          />
          <Input
            type="number"
            min={1}
            aria-label={`Quantidade ${index + 1}`}
            placeholder="Qtd."
            value={item.quantidade ?? ""}
            onChange={(e) => update(index, { quantidade: toInt(e.target.value) })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Remover linha ${index + 1}`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { material: "", quantidade: null }])}
        >
          <Plus className="h-4 w-4" /> Adicionar linha
        </Button>
      </div>
    </div>
  );
}

export function NewSurgicalAppointmentDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const create = useCreateSurgicalAppointment();
  const { user } = useSession();

  function set(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setD<K extends keyof SurgicalRequestDetails>(
    key: K,
    value: SurgicalRequestDetails[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    const cpf = form.patientCpf.replace(/\D/g, "");
    if (!form.patientName.trim()) return void toast.error("Informe o nome do paciente.");
    if (!isValidCpf(cpf)) return void toast.error("Informe um CPF válido.");
    if (!form.diagnostico.trim()) return void toast.error("Informe o diagnóstico.");
    if (!form.alergias.trim()) return void toast.error("Informe as alergias.");
    if (!form.cid.trim()) return void toast.error("Informe o CID.");
    if (!form.ctiResposta)
      return void toast.error("Informe se haverá utilização de CTI no POI.");
    if (form.ctiResposta === "sim" && !form.motivoCti.trim())
      return void toast.error("Informe o motivo da solicitação de vaga no CTI.");
    if (!form.procedimentoPrincipal.length)
      return void toast.error("Informe o procedimento principal.");
    if (
      [...form.procedimentoPrincipal, ...form.procedimentosAdicionais].some(
        (item) => !Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 10000,
      )
    )
      return void toast.error("Informe quantidades inteiras entre 1 e 10.000.");
    if (!form.lateralidade) return void toast.error("Informe a lateralidade.");
    if (!form.regimeInternacao) return void toast.error("Informe o regime de internação.");
    if (!form.origemPaciente) return void toast.error("Informe a origem do paciente.");
    if (form.origemPaciente === "Outro" && !form.origemOutros.trim())
      return void toast.error("Descreva a origem do paciente.");
    if (!form.convenio.trim()) return void toast.error("Informe o convênio.");
    if (!form.dataCirurgia) return void toast.error("Informe a data da cirurgia.");
    if (form.dataCirurgia.slice(0, 10) < today())
      return void toast.error("A data da cirurgia não pode estar no passado.");
    if (!form.duracaoPrevistaMin || form.duracaoPrevistaMin < 1)
      return void toast.error("Informe a duração prevista em minutos.");
    if (!form.porte) return void toast.error("Informe o porte da cirurgia.");
    if (!form.anestesia) return void toast.error("Informe a anestesia.");
    if (form.numAuxiliares === null)
      return void toast.error("Informe o número de auxiliares.");
    if (!form.jeovaResposta)
      return void toast.error("Informe se o paciente é Testemunha de Jeová.");
    if (!form.transfusaoResposta)
      return void toast.error("Informe sobre transfusão de hemoderivados.");
    if (!form.anatomiaPatologica)
      return void toast.error("Informe a anatomia patológica.");
    if (form.anatomiaPatologica === "Sim" && (!form.anatomiaQuantidade || form.anatomiaQuantidade < 1))
      return void toast.error("Informe a quantidade da anatomia patológica.");
    if (form.equipamentos.includes("Outros") && !form.equipamentosOutros.trim())
      return void toast.error("Descreva os outros equipamentos.");

    const desiredDate = form.dataCirurgia.slice(0, 10);
    const dados: SurgicalRequestDetails = {
      ...form,
      procedimentoPrincipal: form.procedimentoPrincipal,
      origemOutros: form.origemOutros.trim(),
      convenio: form.convenio.trim(),
      motivoCti: form.motivoCti.trim(),
      diagnostico: form.diagnostico.trim(),
      alergias: form.alergias.trim(),
      cid: form.cid.trim(),
      equipamentosOutros: form.equipamentosOutros.trim(),
    };

    try {
      await create.mutateAsync({
        patientName: form.patientName.trim(),
        patientCpf: cpf,
        desiredDate,
        dados,
      });
      toast.success("Solicitação de procedimento cirúrgico criada.");
      setForm(initialForm);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível criar a solicitação.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Solicitação de procedimento cirúrgico</DialogTitle>
          <DialogDescription>
            Preencha os dados do paciente, da cirurgia e dos materiais para solicitar o
            agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {/* Paciente e dados clínicos */}
          <div className="grid gap-4">
            <SectionTitle>Paciente</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<span>Nome do paciente <RequiredMark /></span>}>
                <Input
                  value={form.patientName}
                  maxLength={120}
                  autoComplete="name"
                  onChange={(event) => set("patientName", event.target.value)}
                />
              </Field>
              <Field label={<span>CPF <RequiredMark /></span>}>
                <Input
                  value={form.patientCpf}
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  onChange={(event) => set("patientCpf", event.target.value)}
                />
              </Field>
            </div>
            <Field label={<span>Diagnóstico <RequiredMark /></span>}>
              <Textarea
                rows={3}
                value={form.diagnostico}
                maxLength={1000}
                onChange={(event) => setD("diagnostico", event.target.value)}
              />
            </Field>
            <Field label={<span>Alergias <RequiredMark /></span>}>
              <Textarea
                rows={3}
                value={form.alergias}
                maxLength={1000}
                onChange={(event) => setD("alergias", event.target.value)}
              />
            </Field>
            <Field label={<span>CID <RequiredMark /></span>}>
              <Textarea
                rows={3}
                value={form.cid}
                maxLength={1000}
                onChange={(event) => setD("cid", event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <YesNoField
                label={<span>Utilização de CTI no POI <RequiredMark /></span>}
                name="cti-poi"
                value={form.ctiResposta}
                onChange={(value) => setD("ctiResposta", value)}
              />
              {form.ctiResposta === "sim" ? (
                <Field label={<span>Motivo solicitação de vaga no CTI <RequiredMark /></span>}>
                  <Textarea
                    rows={2}
                    value={form.motivoCti}
                    maxLength={1000}
                    onChange={(event) => setD("motivoCti", event.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Motivo solicitação de vaga no CTI">
                  <Textarea rows={2} disabled value="" onChange={() => undefined} />
                </Field>
              )}
            </div>
          </div>

          {/* Informações sobre a cirurgia */}
          <div className="grid gap-4">
            <SectionTitle>Informações sobre a cirurgia</SectionTitle>
            <Field label={<span>Procedimento principal <RequiredMark /></span>}>
              <ProcedureSelect
                value={form.procedimentoPrincipal}
                onChange={(items) => setD("procedimentoPrincipal", items)}
                placeholder="Pesquisar procedimento principal..."
              />
            </Field>
            <Field label="Procedimentos adicionais">
              <ProcedureSelect
                value={form.procedimentosAdicionais}
                onChange={(items) => setD("procedimentosAdicionais", items)}
                placeholder="Pesquisar procedimentos adicionais..."
                multiple
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label={<span>Lateralidade <RequiredMark /></span>}
                id="cirurgia-lateralidade"
                value={form.lateralidade}
                onChange={(value) => setD("lateralidade", value)}
                options={lateralidadeOptions}
              />
              <SelectField
                label={<span>Regime de internação <RequiredMark /></span>}
                id="cirurgia-regime"
                value={form.regimeInternacao}
                onChange={(value) => setD("regimeInternacao", value)}
                options={regimeInternacaoOptions}
              />
              <SelectField
                label="Tipo"
                id="cirurgia-tipo"
                value={form.tipo}
                onChange={(value) => setD("tipo", value)}
                options={tipoCirurgiaOptions}
                placeholder="Selecione…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={<span>Origem do paciente <RequiredMark /></span>}
                id="cirurgia-origem"
                value={form.origemPaciente}
                onChange={(value) => setD("origemPaciente", value)}
                options={origemPacienteOptions}
              />
              {form.origemPaciente === "Outro" ? (
                <Field label={<span>Outros <RequiredMark /></span>}>
                  <Input
                    value={form.origemOutros}
                    maxLength={120}
                    onChange={(event) => setD("origemOutros", event.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Outros">
                  <Input disabled value="" onChange={() => undefined} />
                </Field>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<span>Convênio <RequiredMark /></span>}>
                <Input
                  value={form.convenio}
                  maxLength={120}
                  placeholder="Nome do convênio"
                  onChange={(event) => setD("convenio", event.target.value)}
                />
              </Field>
              <Field label={<span>Cirurgião <RequiredMark /></span>}>
                <Input value={user?.nome ?? ""} disabled readOnly />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<span>Data da cirurgia <RequiredMark /></span>}>
                <Input
                  type="datetime-local"
                  min={nowLocal()}
                  value={form.dataCirurgia}
                  onChange={(event) => setD("dataCirurgia", event.target.value)}
                />
              </Field>
              <Field label={<span>Duração prevista em min <RequiredMark /></span>}>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.duracaoPrevistaMin ?? ""}
                  onChange={(event) =>
                    setD("duracaoPrevistaMin", toInt(event.target.value))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label={<span>Porte da cirurgia <RequiredMark /></span>}
                id="cirurgia-porte"
                value={form.porte}
                onChange={(value) => setD("porte", value)}
                options={porteCirurgiaOptions}
              />
              <SelectField
                label={<span>Anestesia <RequiredMark /></span>}
                id="cirurgia-anestesia"
                value={form.anestesia}
                onChange={(value) => setD("anestesia", value)}
                options={anestesiaOptions}
              />
              <Field label={<span>Nº de auxiliares <RequiredMark /></span>}>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.numAuxiliares ?? ""}
                  onChange={(event) => setD("numAuxiliares", toInt(event.target.value))}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <YesNoField
                label={<span>Paciente Testemunha de Jeová? <RequiredMark /></span>}
                name="jeova"
                value={form.jeovaResposta}
                onChange={(value) => setD("jeovaResposta", value)}
              />
              <YesNoField
                label={<span>Transfusão de hemoderivados <RequiredMark /></span>}
                name="transfusao"
                value={form.transfusaoResposta}
                onChange={(value) => setD("transfusaoResposta", value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={<span>Anatomia patológica <RequiredMark /></span>}
                id="cirurgia-anatomia"
                value={form.anatomiaPatologica}
                onChange={(value) => setD("anatomiaPatologica", value)}
                options={anatomiaPatologicaOptions}
              />
              <Field label={<span>Quantidade <RequiredMark /></span>}>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  disabled={form.anatomiaPatologica !== "Sim"}
                  value={form.anatomiaQuantidade ?? ""}
                  onChange={(event) =>
                    setD("anatomiaQuantidade", toInt(event.target.value))
                  }
                />
              </Field>
            </div>
          </div>

          {/* Equipamentos e materiais especiais */}
          <div className="grid gap-4">
            <SectionTitle>Equipamentos e materiais especiais a serem utilizados</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {equipamentosOptions.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.equipamentos.includes(option)}
                    onCheckedChange={(checked) =>
                      setD(
                        "equipamentos",
                        checked
                          ? [...form.equipamentos, option]
                          : form.equipamentos.filter((item) => item !== option),
                      )
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={
                  form.equipamentos.includes("Outros")
                    ? <span>Outros <RequiredMark /></span>
                    : "Outros"
                }
              >
                <Input
                  value={form.equipamentosOutros}
                  maxLength={120}
                  disabled={!form.equipamentos.includes("Outros")}
                  onChange={(event) => setD("equipamentosOutros", event.target.value)}
                />
              </Field>
              <SelectField
                label="Movimento do paciente"
                id="cirurgia-movimento"
                value={form.movimentoPaciente}
                onChange={(value) => setD("movimentoPaciente", value)}
                options={movimentoPacienteOptions}
                placeholder="Selecione…"
              />
            </div>
            <Field label="Descrição do material especial (OPME)">
              <MaterialRows
                items={form.opme}
                onChange={(items) => setD("opme", items)}
                materialLabel="Material"
              />
            </Field>
          </div>

          {/* Reserva de fios cirúrgicos */}
          <div className="grid gap-4">
            <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-center text-sm font-semibold text-warning-foreground">
              OBS: PRAZO MÍNIMO DE 72 HORAS PARA AUTORIZAÇÃO E AQUISIÇÃO DO MATERIAL
              SOLICITADO
            </p>
            <SectionTitle>Reserva de fios cirúrgicos (padrão e não padrão)</SectionTitle>
            <MaterialRows
              items={form.fiosCirurgicos}
              onChange={(items) => setD("fiosCirurgicos", items)}
              materialLabel="Descrição"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={create.isPending} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending ? "Salvando…" : "Enviar solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
