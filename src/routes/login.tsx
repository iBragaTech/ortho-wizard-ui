import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Briefcase, LogIn, Stethoscope, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalUsers } from "@/lib/data/hooks";
import { PERFIS, useSession, type Perfil } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Portal de Orçamentos de Consultas" },
      {
        name: "description",
        content: "Acesse o portal interno escolhendo seu perfil: administrador, comercial ou médico.",
      },
      { property: "og:title", content: "Entrar — Portal de Orçamentos de Consultas" },
      {
        property: "og:description",
        content: "Área de acesso do portal hospitalar de orçamentos de consultas particulares.",
      },
    ],
  }),
  component: LoginPage,
});

const perfilIcon: Record<Perfil, typeof UserCog> = {
  Administrador: UserCog,
  Comercial: Briefcase,
  "Médico": Stethoscope,
};

const perfilDesc: Record<Perfil, string> = {
  Administrador: "Acesso completo ao portal",
  Comercial: "Valores hospitalares e fila comercial",
  "Médico": "Honorários médicos das solicitações",
};

function LoginPage() {
  const navigate = useNavigate();
  const { user, ready, signIn } = useSession();
  const { data: users = [], isLoading } = usePortalUsers();
  const [perfil, setPerfil] = useState<Perfil>("Administrador");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (ready && user) void navigate({ to: "/", replace: true });
  }, [ready, user, navigate]);

  const doPerfil = users.filter((u) => u.perfil === perfil && u.ativo);

  useEffect(() => {
    setUserId(doPerfil[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, users.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selected = doPerfil.find((u) => u.id === userId);
    if (!selected) {
      toast.error("Selecione um usuário para entrar.");
      return;
    }
    signIn({ id: selected.id, nome: selected.nome, email: selected.email, perfil });
    toast.success(`Bem-vindo(a), ${selected.nome.split(" ")[0]}!`);
    void navigate({ to: "/", replace: true });
  }

  return (
    <main className="grid min-h-screen bg-muted/40 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-foreground/15">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Portal de Orçamentos</p>
            <p className="text-xs opacity-80">Consultas particulares</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Orçamentos hospitalares com fluxo claro do início ao fim
          </h1>
          <p className="text-sm opacity-85">
            Solicitação, honorários médicos, valores hospitalares e envio do orçamento ao paciente
            em um único ambiente.
          </p>
        </div>
        <p className="text-xs opacity-70">Ambiente interno · uso restrito</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Entrar no portal</CardTitle>
            <CardDescription>Escolha o perfil de acesso e o usuário.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Perfil de acesso</Label>
                <div className="grid gap-2">
                  {PERFIS.map((p) => {
                    const Icon = perfilIcon[p];
                    const active = perfil === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPerfil(p)}
                        aria-pressed={active}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">{p}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {perfilDesc[p]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usuario">Usuário</Label>
                <Select value={userId} onValueChange={setUserId} disabled={isLoading || doPerfil.length === 0}>
                  <SelectTrigger id="usuario">
                    <SelectValue
                      placeholder={
                        isLoading
                          ? "Carregando usuários..."
                          : doPerfil.length === 0
                            ? "Nenhum usuário com este perfil"
                            : "Selecione o usuário"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {doPerfil.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" placeholder="••••••••" autoComplete="current-password" />
                <p className="text-xs text-muted-foreground">
                  Protótipo: a senha ainda não é validada.
                </p>
              </div>

              <Button type="submit" className="w-full">
                <LogIn className="h-4 w-4" /> Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
