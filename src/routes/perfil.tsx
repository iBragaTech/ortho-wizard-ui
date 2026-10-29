import { createFileRoute } from "@tanstack/react-router";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { UserAvatar } from "@/components/portal/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession, type Perfil } from "@/lib/auth/session";

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
  const { user } = useSession();
  if (!user) return null;

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
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <dt className="w-20 shrink-0 text-muted-foreground">Nome</dt>
                <dd className="min-w-0 truncate font-medium text-foreground">{user.nome}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <dt className="w-20 shrink-0 text-muted-foreground">E-mail</dt>
                <dd className="min-w-0 truncate font-medium text-foreground">{user.email}</dd>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <dt className="w-20 shrink-0 text-muted-foreground">Perfil</dt>
                <dd className="min-w-0 truncate font-medium text-foreground">{user.perfil}</dd>
              </div>
            </dl>
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
              Para alterar seus dados ou senha, procure um usuário com perfil Administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
