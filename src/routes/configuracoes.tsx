import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/portal/app-shell";
import { PageHeader } from "@/components/portal/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSaveSettings, useSettings } from "@/lib/data/hooks";

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
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (settings) {
      setNome(settings.nome);
      setEmail(settings.emailNotificacoes);
    }
  }, [settings]);

  async function handleSave() {
    try {
      await save.mutateAsync({
        nome,
        cnpj: settings?.cnpj ?? "",
        endereco: settings?.endereco ?? "",
        telefone: settings?.telefone ?? "",
        emailNotificacoes: email,
      });
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Configurações"
        description="Dados da instituição e preferências de notificação do portal."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Dados da instituição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="inst">Nome do hospital</Label>
              <Input id="inst" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contato">E-mail de contato</Label>
              <Input id="contato" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="w-full sm:w-auto" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
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
