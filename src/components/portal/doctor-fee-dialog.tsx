import { useEffect, useState } from "react";
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
import { type ConsultationRequest } from "@/data/mock";
import { useSaveDoctorFees } from "@/lib/data/hooks";

function toNumber(value: string): number | null {
  const clean = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!clean.trim()) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function fromNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export function DoctorFeeDialog({ request }: { request: ConsultationRequest }) {
  const filled = request.honorariosMedicos !== null;
  const [open, setOpen] = useState(false);
  const save = useSaveDoctorFees();

  const initial = {
    honorario: fromNumber(request.honorariosMedicos),
    diaria: fromNumber(request.diaria),
    cti: fromNumber(request.cti),
    fisioterapia: request.fisioterapia !== null ? String(request.fisioterapia) : "",
    tempoBloco: request.tempoBloco,
    opme: request.opme,
    anatomo: request.anatomoPatologico,
    sangue: request.reservaSangue,
    equipe: request.equipeMultidisciplinar,
    obs: request.obsMedico,
  };
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request.id]);

  const set = (key: keyof typeof initial) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    try {
      await save.mutateAsync({
        id: request.id,
        input: {
          honorariosMedicos: toNumber(form.honorario),
          diaria: toNumber(form.diaria),
          cti: toNumber(form.cti),
          opme: form.opme,
          anatomoPatologico: form.anatomo,
          reservaSangue: form.sangue,
          equipeMultidisciplinar: form.equipe,
          fisioterapia: form.fisioterapia ? Number(form.fisioterapia) : null,
          tempoBloco: form.tempoBloco,
          obsMedico: form.obs,
        },
      });
      toast.success("Honorários enviados ao Comercial.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar os honorários.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={filled ? "outline" : "default"} size="sm" className="w-full sm:w-auto">
          {filled ? "Revisar honorários" : "Preencher honorários"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preenchimento médico</DialogTitle>
          <DialogDescription>
            {request.numero} · {request.paciente.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Valores médicos
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="honorario">Honorário</Label>
                <Input
                  id="honorario"
                  placeholder="0,00"
                  value={form.honorario}
                  onChange={(e) => set("honorario")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="diaria">Diária</Label>
                <Input
                  id="diaria"
                  placeholder="0,00"
                  value={form.diaria}
                  onChange={(e) => set("diaria")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cti">CTI</Label>
                <Input
                  id="cti"
                  placeholder="0,00"
                  value={form.cti}
                  onChange={(e) => set("cti")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fisioterapia">Fisioterapia (quantidade)</Label>
                <Input
                  id="fisioterapia"
                  type="number"
                  placeholder="Ex.: 4"
                  value={form.fisioterapia}
                  onChange={(e) => set("fisioterapia")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tempo-bloco">Tempo de bloco</Label>
                <Input
                  id="tempo-bloco"
                  placeholder="Ex.: 2h30"
                  value={form.tempoBloco}
                  onChange={(e) => set("tempoBloco")(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Procedimento e materiais
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="opme">OPME (descrição detalhada do item, quantidade e fornecedor)</Label>
                <Textarea
                  id="opme"
                  rows={3}
                  placeholder="Descreva o item, a quantidade e o fornecedor"
                  value={form.opme}
                  onChange={(e) => set("opme")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="anatomo">Anatomo Patológico</Label>
                <Textarea
                  id="anatomo"
                  rows={2}
                  value={form.anatomo}
                  onChange={(e) => set("anatomo")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sangue">Reserva de sangue (material e quantidade)</Label>
                <Textarea
                  id="sangue"
                  rows={2}
                  value={form.sangue}
                  onChange={(e) => set("sangue")(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="equipe">Equipe multidisciplinar</Label>
                <Textarea
                  id="equipe"
                  rows={2}
                  value={form.equipe}
                  onChange={(e) => set("equipe")(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-2">
            <Label htmlFor="observacao">Observações gerais do médico</Label>
            <Textarea
              id="observacao"
              rows={3}
              value={form.obs}
              onChange={(e) => set("obs")(e.target.value)}
            />
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Enviar ao Comercial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
