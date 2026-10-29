import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { UserAvatar } from "@/components/portal/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession, type Perfil } from "@/lib/auth/session";
import { useUpdateMyProfile } from "@/lib/data/hooks";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Portal de Orçamentos de Consultas" },
      {
        name: "description",
        content: "Dados da conta e permissões do usuário logado no portal de orçamentos.",
      },
      { property: "og:title", content: "Meu perfil — Portal de Orçamentos de Consultas" },
      {
        property: "og:description",
        content: "Dados da conta e permissões do usuário logado no portal de orçamentos.",
      },
    ],
  }),
  component: PerfilPage,
});

const perfilDescricao: Record<Perfil, string[]> = {
  Administrador: [
    "Acesso a todas as áreas do portal",
    "Gestão de usuários e configurações",
    "Visualização de todos os orçamentos e solicitações cirúrgicas",
  ],
  Comercial: [
    "Visualização de todos os orçamentos",
    "Preenchimento de valores hospitalares",
    "Acesso à Área Comercial",
  ],
  Médico: [
    "Criação de orçamentos com dados médicos",
    "Visualização apenas dos próprios orçamentos",
    "Criação e acompanhamento das próprias solicitações cirúrgicas",
  ],
  Custos: ["Acompanhamento dos orçamentos para revisão de valores"],
};

function PerfilPage() {
  const { user, updateUser } = useSession();
  const update = useUpdateMyProfile();
  const [nome, setNome] = useState(user?.nome ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telefone, setTelefone] = useState(user?.telefone ?? "");

  if (!user) return null;

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const podeSalvar =
    nome.trim().length >= 3 &&
    emailValido &&
    !update.isPending &&
    (nome.trim() !== user.nome || email.trim() !== user.email || telefone.trim() !== (user.telefone ?? ""));

  async function handleSave() {
    if (!user) return;
    try {
      const saved = await update.mutateAsync({
        id: user.id,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
      });
      updateUser({ nome: saved.nome, email: saved.email, telefone: saved.telefone });
      toast.success("Perfil atualizado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    }
  }

  return (
    <AppShell>
      <PageHeader title="Meu perfil" description="Dados da sua conta e permissões de acesso." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Dados da conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <UserAvatar name={user.nome} />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-foreground">{user.nome}</p>
                <p className="truncate text-sm text-muted-foreground">{user.perfil}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="perfil-nome" className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 text-muted-foreground" /> Nome completo
                </Label>
                <Input
                  id="perfil-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perfil-email" className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> E-mail
                </Label>
                <Input
                  id="perfil-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                {email.trim() !== "" && !emailValido ? (
                  <p className="text-xs text-destructive">Informe um e-mail válido.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perfil-telefone" className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Telefone
                </Label>
                <Input
                  id="perfil-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(31) 99999-0000"
                  autoComplete="tel"
                />
              </div>
            </div>

            <Button onClick={() => void handleSave()} disabled={!podeSalvar} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              {update.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Permissões do perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-foreground">
              {(perfilDescricao[user.perfil] ?? []).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Para alterar seu perfil de acesso ou senha, procure um usuário com perfil
              Administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
