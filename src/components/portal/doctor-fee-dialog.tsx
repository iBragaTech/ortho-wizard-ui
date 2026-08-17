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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preenchimento médico</DialogTitle>
          <DialogDescription>
            {request.numero} · {request.paciente.nome} — formulário demonstrativo, sem persistência.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Valores médicos
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="honorario">Honorário</Label>
                <Input
                  id="honorario"
                  placeholder="R$ 0,00"
                  defaultValue={filled ? formatCurrency(request.honorariosMedicos) : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="diaria">Diária</Label>
                <Input
                  id="diaria"
                  placeholder="R$ 0,00"
                  defaultValue={request.diaria !== null ? formatCurrency(request.diaria) : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cti">CTI</Label>
                <Input
                  id="cti"
                  placeholder="R$ 0,00"
                  defaultValue={request.cti !== null ? formatCurrency(request.cti) : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fisioterapia">Fisioterapia (quantidade)</Label>
                <Input
                  id="fisioterapia"
                  type="number"
                  placeholder="Ex.: 4"
                  defaultValue={request.fisioterapia !== null ? String(request.fisioterapia) : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tempo-bloco">Tempo de bloco</Label>
                <Input
                  id="tempo-bloco"
                  placeholder="Ex.: 2h30"
                  defaultValue={request.tempoBloco}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Procedimento e materiais
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="opme">OPME (descrição detalhada do item, quantidade e fornecedor)</Label>
                <Textarea
                  id="opme"
                  rows={3}
                  placeholder="Descreva o item, a quantidade e o fornecedor"
                  defaultValue={request.opme}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="anatomo">Anatomo Patológico</Label>
                <Textarea
                  id="anatomo"
                  rows={2}
                  placeholder="Descrição do anatomo patológico"
                  defaultValue={request.anatomoPatologico}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sangue">Reserva de sangue (material e quantidade)</Label>
                <Textarea
                  id="sangue"
                  rows={2}
                  placeholder="Ex.: 2 concentrados de hemácias"
                  defaultValue={request.reservaSangue}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="equipe">Equipe multidisciplinar</Label>
                <Textarea
                  id="equipe"
                  rows={2}
                  placeholder="Ex.: Fisioterapia 2x/dia, Nutricionista 1x"
                  defaultValue={request.equipeMultidisciplinar}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-2">
            <Label htmlFor="observacao">Observações gerais do médico</Label>
            <Textarea
              id="observacao"
              rows={3}
              placeholder="Informações adicionais sobre a consulta ou procedimento"
              defaultValue={request.obsMedico}
            />
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto">Cancelar</Button>
          <Button className="w-full sm:w-auto">Enviar ao Comercial</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
