import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Portal de Orçamentos" },
      {
        name: "description",
        content: "Preferências gerais do portal interno de orçamentos de consultas particulares.",
      },
      { property: "og:title", content: "Configurações — Portal de Orçamentos" },
      {
        property: "og:description",
        content: "Ajustes visuais e preferências do portal, ainda sem persistência de dados.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function Toggle({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked />
    </div>
  );
}

function ConfiguracoesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Configurações"
        description="Preferências demonstrativas do portal. Nenhuma alteração é salva nesta etapa."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Dados da instituição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="inst">Nome do hospital</Label>
              <Input id="inst" defaultValue="Hospital Modelo (exemplo)" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contato">E-mail de contato</Label>
              <Input id="contato" defaultValue="orcamentos@hospital.exemplo" />
            </div>
            <Button className="w-full sm:w-auto">Salvar alterações</Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Notificações</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border py-0">
            <Toggle
              title="Novas solicitações"
              description="Avisar quando uma solicitação for registrada."
            />
            <Separator className="hidden" />
            <Toggle
              title="Honorários preenchidos"
              description="Avisar o Comercial quando o médico concluir o preenchimento."
            />
            <Toggle
              title="Orçamento concluído"
              description="Avisar a equipe quando o orçamento final estiver disponível."
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
