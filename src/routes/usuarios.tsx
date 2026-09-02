import { createFileRoute } from "@tanstack/react-router";
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
import { usePortalUsers } from "@/lib/data/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Portal de Orçamentos" },
      {
        name: "description",
        content: "Gerenciamento visual dos usuários do portal: administradores, comercial e médicos.",
      },
      { property: "og:title", content: "Usuários — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Perfis de acesso, status e último acesso dos usuários do portal interno.",
      },
    ],
  }),
  component: UsuariosPage,
});

const perfilStyle: Record<string, string> = {
  Administrador: "bg-primary-soft text-accent-foreground ring-primary/25",
  Comercial: "bg-muted text-secondary-foreground ring-border",
  Médico: "bg-success-soft text-success ring-success/25",
};

function UsuariosPage() {
  const { data: users = [] } = usePortalUsers();

  return (
    <AppShell>
      <PageHeader
        title="Usuários"
        description="Perfis de acesso ao portal. A autenticação real será implementada em etapa futura."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Novo usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo usuário</DialogTitle>
                <DialogDescription>
                  Cadastro demonstrativo — sem autenticação nesta etapa.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome-usuario">Nome</Label>
                  <Input id="nome-usuario" placeholder="Nome completo" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email-usuario">E-mail</Label>
                  <Input id="email-usuario" type="email" placeholder="nome@hospital.exemplo" />
                </div>
                <div className="grid gap-2">
                  <Label>Perfil</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="Médico">Médico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button>Cadastrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar name={u.nome} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{u.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  perfilStyle[u.perfil],
                )}
              >
                {u.perfil}
              </span>
              <span className="text-xs text-muted-foreground">
                {u.ativo ? "Ativo" : "Inativo"} · {u.ultimoAcesso}
              </span>
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
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={u.nome} className="h-8 w-8" />
                      <span className="truncate font-medium text-foreground">{u.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                        perfilStyle[u.perfil],
                      )}
                    >
                      {u.perfil}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.ativo ? "Ativo" : "Inativo"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {u.ultimoAcesso}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
