import { useSession } from "@/lib/auth/session";
import { RequiredMark } from "./item-quantity";
import { localAuthEnabled } from "@/lib/data/local-api";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TasyInsuranceSelect } from "@/components/portal/tasy-insurance-select";
import { useCreateRequest } from "@/lib/data/hooks";
import { TasyOpmeSelect, type TasyOpmeItem } from "@/components/portal/tasy-opme-select";
import {
  TasyMaterialSelect,
  type TasyMaterialItem,
} from "@/components/portal/tasy-material-select";
import {
  TasyProcedureSelect,
  type TasyProcedureItem,
} from "@/components/portal/tasy-procedure-select";
import { TasyPatientSearch } from "@/components/portal/tasy-patient-search";
import { isValidCpf, telefonePessoaTasy } from "@/lib/data/tasy";
import { getTasyClient } from "@/lib/data/tasy-supabase";

const empty = {
  nome: "",
  nascimento: "",
  cpf: "",
  telefone: "",
  convenio: "",
  categoriaConvenio: "",
  // Campos do Comercial
  acomodacao: "",
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
  origem: origemProp = "comercial",
}: {
  trigger: ReactNode;
  origem?: "comercial" | "medico";
}) {
  const [open, setOpen] = useState(false);
  const [patientRevision, setPatientRevision] = useState(0);
  const [patientCode, setPatientCode] = useState("");
  const [patientNotFound, setPatientNotFound] = useState(false);
  const [form, setForm] = useState(empty);
  const [opme, setOpme] = useState<TasyOpmeItem[]>([]);
  const [materiais, setMateriais] = useState<TasyMaterialItem[]>([]);
  const [procedimento, setProcedimento] = useState<TasyProcedureItem[]>([]);
  const [adicionais, setAdicionais] = useState<TasyProcedureItem[]>([]);
  const [catalogContext, setCatalogContext] = useState({ cdConvenio: "", cdCategoria: "" });
  const [temCti, setTemCti] = useState(false);
  const create = useCreateRequest();
  const { user } = useSession();
  const origem = user?.perfil === "Médico" ? "medico" : origemProp;
  const isMedico = origem === "medico";
  const patientFieldsEditable = patientNotFound;

  const set = (key: keyof typeof empty) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!form.nome.trim() || !form.cpf.trim()) {
      toast.error("Informe ao menos nome e CPF do paciente.");
      return;
    }
    if (!isValidCpf(form.cpf)) {
      toast.error("Informe um CPF válido com 11 dígitos.");
      return;
    }

    if (
      localAuthEnabled &&
      (!catalogContext.cdConvenio ||
        !catalogContext.cdCategoria ||
        !procedimento.length ||
        (!patientCode && !patientNotFound))
    ) {
      toast.error(
        !patientCode && !patientNotFound
          ? "Busque e selecione o paciente no Tasy."
          : !catalogContext.cdConvenio
            ? "Selecione o convênio."
            : !catalogContext.cdCategoria
              ? "Selecione a categoria do convênio."
              : "Selecione o procedimento principal.",
      );
      return;
    }
    if (patientNotFound && !form.nascimento) {
      toast.error("Informe a data de nascimento.");
      return;
    }
    if (
      [...procedimento, ...adicionais, ...materiais, ...opme].some(
        (item) =>
          !Number.isInteger(item.quantidade ?? 1) ||
          (item.quantidade ?? 1) < 1 ||
          (item.quantidade ?? 1) > 10000,
      )
    ) {
      toast.error("Informe quantidades inteiras entre 1 e 10.000.");
      return;
    }
    const opmeTexto = opme.map((item) => `${item.codigo} - ${item.nome}`).join("; ");
    const materiaisTexto = materiais.map((item) => `${item.codigo} - ${item.nome}`).join("; ");
    const convenioTexto = form.convenio.trim() ? `Convênio: ${form.convenio.trim()}` : "";
    const categoriaTexto = form.categoriaConvenio
      ? `Categoria do convênio: ${form.categoriaConvenio}`
      : "";
    const formatProcedure = (p: TasyProcedureItem) =>
      `${p.codigo} (origem ${p.origem}) - ${p.nome}`;
    const principalTexto = procedimento[0] ? formatProcedure(procedimento[0]) : "";
    const adicionaisTexto = adicionais.map(formatProcedure).join("; ");

    const observacoes = isMedico
      ? [
          convenioTexto,
          categoriaTexto,
          principalTexto && `Procedimento principal: ${principalTexto}`,
          adicionaisTexto && `Procedimentos adicionais: ${adicionaisTexto}`,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          convenioTexto,
          categoriaTexto,
          principalTexto && `Procedimento principal: ${principalTexto}`,
          adicionaisTexto && `Procedimentos adicionais: ${adicionaisTexto}`,
          form.acomodacao &&
            `Acomodação: ${form.acomodacao === "enfermaria" ? "Enfermaria" : "Apartamento"}`,
          form.diariaEnf && `Diária Enf/Ap: ${form.diariaEnf}`,
          temCti && form.diariaCti && `Diária CTI: ${form.diariaCti}`,
          opmeTexto && `OPME: ${opmeTexto}`,
          materiaisTexto && `Materiais: ${materiaisTexto}`,
          form.anatomo && `Anatomo patológico: ${form.anatomo}`,
          form.sangue && `Reserva de sangue: ${form.sangue}`,
          form.multidisciplinar && `Equipe multidisciplinar/Fisioterapia: ${form.multidisciplinar}`,
          form.bloco && `Tempo de bloco: ${form.bloco}`,
        ]
          .filter(Boolean)
          .join("\n");

    try {
      let tasyPatientCode = patientCode;
      if (patientNotFound && !tasyPatientCode) {
        const createdPatient = await getTasyClient().salvarPessoaFisica({
          nmPessoaFisica: form.nome.trim(),
          dtNascimento: form.nascimento,
          nrCpf: form.cpf.trim().replace(/\D/g, ""),
        });
        tasyPatientCode = createdPatient.cdPessoaFisica;
        setPatientCode(tasyPatientCode);
        toast.success(`Pessoa cadastrada no Tasy com código ${tasyPatientCode}.`);
      }
      await create.mutateAsync({
        nome: form.nome.trim(),
        nascimento: form.nascimento,
        cpf: form.cpf.trim(),
        telefone: form.telefone.trim(),
        especialidade: principalTexto,
        observacoes,
        origem,
        ...(tasyPatientCode &&
        catalogContext.cdConvenio &&
        catalogContext.cdCategoria &&
        procedimento.length
          ? {
              tasy: {
                cdPessoaFisica: tasyPatientCode,
                ...catalogContext,
                convenioNome: form.convenio,
                categoriaNome: form.categoriaConvenio,
                procedimentos: [...procedimento, ...adicionais].map(
                  ({ codigo, origem, quantidade = 1 }) => ({
                    codigo,
                    origem,
                    quantidade,
                  }),
                ),
                materiais: [...materiais, ...opme].map(({ codigo, quantidade = 1 }) => ({
                  codigo,
                  quantidade,
                })),
              },
            }
          : {}),
        ...(isMedico
          ? {
              medico: {
                honorariosMedicos: localAuthEnabled ? null : toNumber(form.honorario),
                diaria: localAuthEnabled ? null : toNumber(form.diaria),
                cti: localAuthEnabled ? null : toNumber(form.cti),
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
        localAuthEnabled
          ? "Orçamento criado. Confira os valores e eventuais pendências nos detalhes."
          : isMedico
            ? "Orçamento criado e enviado ao Comercial."
            : "Orçamento criado e enviado ao médico.",
      );
      setForm(empty);
      setPatientCode("");
      setPatientNotFound(false);
      setTemCti(false);
      setOpme([]);
      setMateriais([]);
      setProcedimento([]);
      setAdicionais([]);
      setCatalogContext({ cdConvenio: "", cdCategoria: "" });

      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o orçamento.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPatientCode("");
          setPatientNotFound(false);
          setCatalogContext({ cdConvenio: "", cdCategoria: "" });
          setProcedimento([]);
          setAdicionais([]);
          setMateriais([]);
          setOpme([]);
          setForm((f) => ({ ...f, convenio: "", categoriaConvenio: "" }));
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription className={localAuthEnabled ? "sr-only" : undefined}>
            {localAuthEnabled
              ? "Cadastro de novo orçamento."
              : isMedico
                ? "Preencha os dados médicos. O orçamento segue para o Comercial completar os valores hospitalares."
                : "Os dados são salvos no banco e o orçamento segue para preenchimento do médico."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Dados do paciente
            </h3>
            {open && (
              <TasyPatientSearch
                onNotFound={(cpf) => {
                  setPatientCode("");
                  setPatientNotFound(true);
                  setForm((f) => ({
                    ...f,
                    nome: "",
                    nascimento: "",
                    cpf,
                    telefone: "",
                  }));
                }}
                onSelect={(person) => {
                  setPatientRevision((r) => r + 1);
                  setPatientCode(person.cdPessoaFisica);
                  setPatientNotFound(false);
                  setCatalogContext({ cdConvenio: "", cdCategoria: "" });
                  setProcedimento([]);
                  setAdicionais([]);
                  setForm((f) => ({
                    ...f,
                    nome: person.nmPessoaFisica ?? "",
                    nascimento: person.dtNascimento ?? "",
                    cpf: person.nrCpf ?? "",
                    telefone: telefonePessoaTasy(person),
                    convenio: "",
                    categoriaConvenio: "",
                  }));
                }}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="nome">
                  Nome completo
                  <RequiredMark />
                </Label>
                <Input
                  id="nome"
                  placeholder="Nome completo do paciente"
                  value={form.nome}
                  disabled={!patientFieldsEditable}
                  onChange={(e) => set("nome")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nascimento">
                  Data de nascimento
                  <RequiredMark />
                </Label>
                <Input
                  id="nascimento"
                  type="date"
                  value={form.nascimento}
                  disabled={!patientFieldsEditable}
                  onChange={(e) => set("nascimento")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpf">
                  CPF
                  <RequiredMark />
                </Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  disabled={!patientFieldsEditable}
                  onChange={(e) => {
                    setPatientCode("");
                    setPatientNotFound(false);
                    set("cpf")(e.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  disabled={!patientFieldsEditable}
                  onChange={(e) => set("telefone")(e.target.value)}
                />
              </div>
              {open && (
                <TasyInsuranceSelect
                  key={patientRevision}
                  onChange={(convenio, categoriaConvenio, cdConvenio, cdCategoria) => {
                    setForm((f) => ({ ...f, convenio, categoriaConvenio }));
                    setCatalogContext({ cdConvenio, cdCategoria });
                    setProcedimento([]);
                    setAdicionais([]);
                  }}
                />
              )}
              <div className="grid gap-2 sm:col-span-2">
                <Label>
                  Procedimento principal
                  <RequiredMark />
                </Label>
                <TasyProcedureSelect
                  key={`principal:${catalogContext.cdConvenio}:${catalogContext.cdCategoria}`}
                  {...catalogContext}
                  value={procedimento}
                  onChange={setProcedimento}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Procedimentos adicionais</Label>
                <TasyProcedureSelect
                  key={`adicionais:${catalogContext.cdConvenio}:${catalogContext.cdCategoria}`}
                  {...catalogContext}
                  value={adicionais}
                  onChange={setAdicionais}
                  multiple
                />
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
                      disabled={localAuthEnabled}
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
                      disabled={localAuthEnabled}
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
                      disabled={localAuthEnabled}
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
                    <Label>Tipo de acomodação</Label>
                    <div className="flex items-center gap-6 pt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.acomodacao === "enfermaria"}
                          onCheckedChange={(c) => set("acomodacao")(c ? "enfermaria" : "")}
                        />
                        Enfermaria
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.acomodacao === "apartamento"}
                          onCheckedChange={(c) => set("acomodacao")(c ? "apartamento" : "")}
                        />
                        Apartamento
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="diaria-enf">Diária Enf / Ap</Label>
                    <Input
                      id="diaria-enf"
                      disabled={localAuthEnabled}
                      placeholder="Quantidade de diárias"
                      value={form.diariaEnf}
                      onChange={(e) => set("diariaEnf")(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={temCti}
                        onCheckedChange={(c) => {
                          setTemCti(Boolean(c));
                          if (!c) set("diariaCti")("");
                        }}
                      />
                      Possui CTI
                    </label>
                  </div>
                  {temCti && (
                    <div className="grid gap-2">
                      <Label htmlFor="diaria-cti">Diária CTI</Label>
                      <Input
                        id="diaria-cti"
                        disabled={localAuthEnabled}
                        placeholder="Quantidade de diárias"
                        value={form.diariaCti}
                        onChange={(e) => set("diariaCti")(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="grid gap-2 sm:col-span-2">
                <Label>Materiais do Tasy</Label>
                <TasyMaterialSelect value={materiais} onChange={setMateriais} />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label>OPME{isMedico ? " (item, quantidade e fornecedor)" : ""}</Label>
                <TasyOpmeSelect value={opme} onChange={setOpme} />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="anamoto">
                  {isMedico ? "Anatomo Patológico" : "Anamoto patológico"}
                </Label>
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
              : isMedico && !localAuthEnabled
                ? "Criar e enviar ao Comercial"
                : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
