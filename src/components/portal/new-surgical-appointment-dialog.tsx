import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { RequiredMark } from "./item-quantity";
import { useCreateSurgicalAppointment } from "@/lib/data/hooks";
import { isValidCpf } from "@/lib/data/tasy";

const initialForm = { patientName: "", patientCpf: "", desiredDate: "" };

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function NewSurgicalAppointmentDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const create = useCreateSurgicalAppointment();

  function set(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    const cpf = form.patientCpf.replace(/\D/g, "");
    if (!form.patientName.trim()) return toast.error("Informe o nome do paciente.");
    if (!isValidCpf(cpf)) return toast.error("Informe um CPF válido.");
    if (!form.desiredDate) return toast.error("Informe a data desejada.");
    if (form.desiredDate < today())
      return toast.error("A data desejada não pode estar no passado.");

    try {
      await create.mutateAsync({
        patientName: form.patientName.trim(),
        patientCpf: cpf,
        desiredDate: form.desiredDate,
      });
      toast.success("Solicitação de agendamento criada.");
      setForm(initialForm);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o agendamento.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Novo agendamento cirúrgico</DialogTitle>
          <DialogDescription>
            Informe o paciente e a data desejada para solicitar o agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="surgical-patient-name">
              Nome do paciente <RequiredMark />
            </Label>
            <Input
              id="surgical-patient-name"
              value={form.patientName}
              maxLength={120}
              autoComplete="name"
              onChange={(event) => set("patientName", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="surgical-patient-cpf">
              CPF <RequiredMark />
            </Label>
            <Input
              id="surgical-patient-cpf"
              value={form.patientCpf}
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              onChange={(event) => set("patientCpf", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="surgical-desired-date">
              Data desejada <RequiredMark />
            </Label>
            <Input
              id="surgical-desired-date"
              type="date"
              min={today()}
              value={form.desiredDate}
              onChange={(event) => set("desiredDate", event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={create.isPending} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending ? "Salvando…" : "Solicitar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}