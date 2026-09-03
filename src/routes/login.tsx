import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { repository } from "@/lib/data/repository";
import { useSession } from "@/lib/auth/session";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Portal de Orçamentos de Consultas" },
      {
        name: "description",
        content: "Acesse o portal interno com seu e-mail e senha cadastrados na instituição.",
      },
      { property: "og:title", content: "Entrar — Portal de Orçamentos de Consultas" },
      {
        property: "og:description",
        content: "Área de acesso do portal hospitalar de orçamentos de consultas particulares.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, ready, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) void navigate({ to: "/", replace: true });
  }, [ready, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      toast.error("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const found = await repository.signIn(email.trim(), senha);
      if (!found) {
        toast.error("E-mail ou senha inválidos.");
        return;
      }
      signIn(found);
      toast.success(`Bem-vindo(a), ${found.nome.split(" ")[0]}!`);
      void navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-muted/40 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="w-fit rounded-xl bg-card p-4">
          <img
            src={logoStacked.url}
            alt="Hospital Evangélico de Belo Horizonte"
            className="h-24 w-auto object-contain"
          />
        </div>
        <div className="max-w-md space-y-4">
          <span className="inline-block h-1 w-16 rounded-full bg-brand-accent" />
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
            <img
              src={logoHorizontal.url}
              alt="Hospital Evangélico de Belo Horizonte"
              className="mb-4 h-10 w-auto object-contain object-left lg:hidden"
            />
            <CardTitle>Entrar no portal</CardTitle>
            <CardDescription>Use o e-mail e a senha cadastrados para você.</CardDescription>
          </CardHeader>
          <CardContent>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@hospital.com.br"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Entrar
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                O perfil de acesso é definido pelo cadastro do usuário no portal.
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
