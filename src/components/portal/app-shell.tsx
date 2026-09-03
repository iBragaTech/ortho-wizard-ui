import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Briefcase,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Stethoscope,
  Users,
  UserRound,
  FileText,
} from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { UserAvatar } from "./user-avatar";
import { ACESSO, useSession, type Perfil } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/area-medico", label: "Área do Médico", icon: Stethoscope },
  { to: "/area-comercial", label: "Área Comercial", icon: Briefcase },
  { to: "/medicos", label: "Médicos", icon: UserRound },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/orcamentos": "Orçamentos",
  "/area-medico": "Área do Médico",
  "/area-comercial": "Área Comercial",
  "/medicos": "Médicos",
  "/usuarios": "Usuários",
  "/configuracoes": "Configurações",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const items = nav.filter((item) => (ACESSO[item.to] ?? []).includes(user?.perfil as Perfil));
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="px-5 py-5">
        <img
          src={logoHorizontal.url}
          alt="Hospital Evangélico de Belo Horizonte"
          className="h-11 w-auto object-contain object-left"
        />
        <p className="mt-3 truncate text-xs font-medium text-muted-foreground">
          Portal de Orçamentos · Consultas particulares
        </p>
      </div>


      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: "exact" in item ? item.exact : false }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2">
          <UserAvatar name={user?.nome ?? ""} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.nome}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.perfil}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start text-muted-foreground"
          onClick={() => {
            signOut();
            void navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, ready, signOut } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = "/" + (pathname.split("/")[1] ?? "");
  const title = titles[base] ?? titles[pathname] ?? "Portal";
  const isDetail = pathname.startsWith("/orcamentos/") && pathname !== "/orcamentos";
  const allowed = ACESSO[base] ?? [];
  const autorizado = !!user && allowed.includes(user.perfil);

  useEffect(() => {
    if (ready && !user) void navigate({ to: "/login", replace: true });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Carregando portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Abrir menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                  <SidebarContent onNavigate={() => setOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>

            <div className="min-w-0">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">Portal</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isDetail ? (
                      <BreadcrumbLink asChild>
                        <Link to="/orcamentos">Orçamentos</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{title}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {isDetail ? (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Detalhes</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  ) : null}
                </BreadcrumbList>
              </Breadcrumb>
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative hidden xl:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="w-64 pl-9" />
              </div>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-success" />
                <span className="sr-only">Notificações</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("rounded-full outline-none ring-offset-2 focus:ring-2 focus:ring-ring")}>
                    <UserAvatar name={user.nome} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium">{user.nome}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user.perfil}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Meu perfil</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/configuracoes">Configurações</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      signOut();
                      void navigate({ to: "/login", replace: true });
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {autorizado ? (
            children
          ) : (
            <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-foreground">Acesso restrito</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                O perfil <strong>{user.perfil}</strong> não tem permissão para esta área do portal.
              </p>
              <Button className="mt-5" onClick={() => void navigate({ to: "/" })}>
                Voltar ao Dashboard
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
