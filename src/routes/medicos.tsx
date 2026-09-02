import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { UserAvatar } from "@/components/portal/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { especialidades } from "@/data/mock";
import { useCreateDoctor, useDoctors } from "@/lib/data/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/medicos")({
  head: () => ({
    meta: [
      { title: "Médicos — Portal de Orçamentos" },
      {
        name: "description",
        content: "Cadastro e listagem dos médicos participantes do portal de orçamentos.",
      },
      { property: "og:title", content: "Médicos — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Consulte médicos, CRM, especialidade e volume de solicitações.",
      },
    ],
  }),
  component: MedicosPage,
});

function ActiveBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        ativo
          ? "bg-success-soft text-success ring-success/25"
          : "bg-muted text-muted-foreground ring-border",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

function NewDoctorDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [crm, setCrm] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const create = useCreateDoctor();

  async function handleSave() {
    if (!nome.trim() || !crm.trim() || !especialidade) {
      toast.error("Preencha nome, CRM e especialidade.");
      return;
    }
    try {
      await create.mutateAsync({ nome: nome.trim(), crm: crm.trim(), especialidade });
      toast.success("Médico cadastrado.");
      setNome("");
      setCrm("");
      setEspecialidade("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Novo médico
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo médico</DialogTitle>
          <DialogDescription>O cadastro é salvo no banco do portal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nome-medico">Nome</Label>
            <Input id="nome-medico" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="crm">CRM</Label>
            <Input id="crm" placeholder="CRM-SP 000000" value={crm} onChange={(e) => setCrm(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Especialidade</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {especialidades.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MedicosPage() {
  const { data: doctors = [] } = useDoctors();

  return (
    <AppShell>
      <PageHeader
        title="Médicos"
        description="Profissionais habilitados a preencher honorários no portal."
        actions={<NewDoctorDialog />}
      />

      <div className="grid gap-3 md:hidden">
        {doctors.map((d) => (
          <div key={d.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <UserAvatar name={d.nome} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{d.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{d.crm}</p>
              </div>
              <ActiveBadge ativo={d.ativo} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Especialidade</p>
                <p className="truncate font-medium text-foreground">{d.especialidade}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Solicitações</p>
                <p className="font-medium text-foreground">{d.solicitacoes}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-card md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nome</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Solicitações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={d.nome} className="h-8 w-8" />
                      <span className="truncate font-medium text-foreground">{d.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.crm}</TableCell>
                  <TableCell className="text-muted-foreground">{d.especialidade}</TableCell>
                  <TableCell>
                    <ActiveBadge ativo={d.ativo} />
                  </TableCell>
                  <TableCell className="text-right font-medium">{d.solicitacoes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
