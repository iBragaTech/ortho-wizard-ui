// Controle de perfil dentro do app (sem autenticação real / sem Supabase Auth).
// A sessão fica no navegador; ao migrar o banco para o Postgres do hospital,
// basta trocar esta camada por autenticação de verdade.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Perfil = "Administrador" | "Comercial" | "Médico";

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
};

type SessionContextValue = {
  user: SessionUser | null;
  ready: boolean;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
};

const STORAGE_KEY = "portal.session";

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch {
      /* sessão inválida — ignora */
    }
    setReady(true);
  }, []);

  const signIn = useCallback((next: SessionUser) => {
    setUser(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage indisponível */
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage indisponível */
    }
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return ctx;
}

export const PERFIS: Perfil[] = ["Administrador", "Comercial", "Médico"];

// Quais perfis podem acessar cada área do portal.
export const ACESSO: Record<string, Perfil[]> = {
  "/": PERFIS,
  "/orcamentos": PERFIS,
  "/area-medico": ["Administrador", "Médico"],
  "/area-comercial": ["Administrador", "Comercial"],
  "/medicos": ["Administrador"],
  "/usuarios": ["Administrador"],
  "/configuracoes": ["Administrador"],
};
