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
import { formatCurrency, type ConsultationRequest } from "@/data/mock";

export function DoctorFeeDialog({ request }: { request: ConsultationRequest }) {
  const filled = request.honorariosMedicos !== null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={filled ? "outline" : "default"} size="sm" className="w-full sm:w-auto">
          {filled ? "Revisar honorários" : "Preencher honorários"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Honorários médicos</DialogTitle>
          <DialogDescription>
            {request.numero} · {request.paciente.nome} — formulário demonstrativo, sem persistência.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="valor">Valor dos honorários</Label>
            <Input
              id="valor"
              placeholder="R$ 0,00"
              defaultValue={filled ? formatCurrency(request.honorariosMedicos) : ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea
              id="observacao"
              rows={4}
              placeholder="Informações sobre a consulta"
              defaultValue={request.obsMedico}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline">Cancelar</Button>
          <Button>Enviar ao Comercial</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
