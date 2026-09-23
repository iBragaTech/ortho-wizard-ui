import { localAuthEnabled } from "@/lib/data/local-api";
import { TasyUserFields, type TasyUserLink } from "@/components/portal/tasy-user-fields";
import { UserTasyLinkDialog } from "@/components/portal/user-tasy-link-dialog";
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
import { useCreateUser, usePortalUsers } from "@/lib/data/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Portal de Orçamentos" },
      {
        name: "description",
        content:
          "Gerenciamento visual dos usuários do portal: administradores, comercial e médicos.",
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

const emptyTasyLink: TasyUserLink = {
  nmUsuario: "",
  cdPerfil: 0,
  cdEstabelecimento: 2,
  consultarTodosPacientes: false,
  cadastrarPacientes: false,
};

const perfilStyle: Record<string, string> = {
  Administrador: "bg-primary-soft text-accent-foreground ring-primary/25",
  Comercial: "bg-muted text-secondary-foreground ring-border",
  Médico: "bg-success-soft text-success ring-success/25",
};

function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<"Administrador" | "Comercial" | "Médico" | "">("");
  const [senha, setSenha] = useState("");
  const [tasyLink, setTasyLink] = useState(emptyTasyLink);
  const create = useCreateUser();

  async function handleSave() {
    if (!nome.trim() || !email.trim() || !perfil) {
      toast.error("Preencha nome, e-mail e perfil.");
      return;
    }
    if (senha.length < (localAuthEnabled ? 12 : 6)) {
      toast.error(
        `A senha inicial precisa ter pelo menos ${localAuthEnabled ? 12 : 6} caracteres.`,
      );
      return;
    }
    if (
      localAuthEnabled &&
      (!tasyLink.nmUsuario.trim() ||
        !Number.isInteger(tasyLink.cdPerfil) ||
        tasyLink.cdPerfil < 1 ||
        !Number.isInteger(tasyLink.cdEstabelecimento) ||
        tasyLink.cdEstabelecimento < 1)
    ) {
      toast.error("Informe o usuário Tasy, o código do perfil e o estabelecimento.");
      return;
    }
    try {
      await create.mutateAsync({
        nome: nome.trim(),
        email: email.trim(),
        perfil,
        senha,
        ...(localAuthEnabled ? tasyLink : {}),
      });
      toast.success("Usuário cadastrado.");
      setNome("");
      setEmail("");
      setPerfil("");
      setSenha("");
      setTasyLink(emptyTasyLink);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            O usuário poderá entrar no portal com o e-mail e a senha inicial informados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nome-usuario">Nome</Label>
            <Input
              id="nome-usuario"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email-usuario">E-mail</Label>
            <Input
              id="email-usuario"
              type="email"
              placeholder="nome@hospital.exemplo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Perfil</Label>
            <Select value={perfil} onValueChange={(v) => setPerfil(v as typeof perfil)}>
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
          {localAuthEnabled && <TasyUserFields value={tasyLink} onChange={setTasyLink} />}
          <div className="grid gap-2">
            <Label htmlFor="senha-usuario">Senha inicial</Label>
            <Input
              id="senha-usuario"
              type="password"
              placeholder={localAuthEnabled ? "Mínimo 12 caracteres" : "Mínimo 6 caracteres"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
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

function UsuariosPage() {
  const { data: users = [] } = usePortalUsers();

  return (
    <AppShell>
      <PageHeader
        title="Usuários"
        description="Perfis de acesso ao portal, com e-mail e senha para entrar no sistema."
        actions={<NewUserDialog />}
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
            {localAuthEnabled && (
              <div className="mt-3">
                <p className="text-sm">
                  Tasy: {u.nmUsuario || "Sem vínculo"} {u.cdPerfil ? ` / ${u.cdPerfil}` : ""}
                </p>
                <UserTasyLinkDialog user={u} />
              </div>
            )}
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
                {localAuthEnabled && <TableHead>Usuário / perfil Tasy</TableHead>}
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
                  {localAuthEnabled && (
                    <TableCell>
                      <p>
                        {u.nmUsuario || "Sem vínculo"} {u.cdPerfil ? ` / ${u.cdPerfil}` : ""}
                      </p>
                      <UserTasyLinkDialog user={u} />
                    </TableCell>
                  )}
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
