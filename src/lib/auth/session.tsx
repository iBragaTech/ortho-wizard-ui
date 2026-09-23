// Supabase Auth is enabled explicitly after provisioning accounts.
// Legacy demo sessions never authenticate requests to the Tasy API.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAuthEnabled, toPortalUser } from "./supabase-auth";
import { localAuthEnabled, localAuth, localAuthEvent } from "@/lib/data/local-api";

export type Perfil = "Administrador" | "Comercial" | "Médico" | "Custos";

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
  signOut: () => Promise<void>;
};

const STORAGE_KEY = "portal.session";

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localAuthEnabled) {
      let alive = true;
      let revision = 0;
      const restore = () => {
        const current = ++revision;
        queryClient.clear();
        void localAuth
          .currentUser()
          .then((next) => {
            if (alive && current === revision) {
              setUser(next);
              setReady(true);
            }
          })
          .catch(() => {
            if (alive && current === revision) {
              setUser(null);
              setReady(true);
            }
          });
      };
      window.addEventListener(localAuthEvent, restore);
      restore();
      return () => {
        alive = false;
        window.removeEventListener(localAuthEvent, restore);
      };
    }
    if (supabaseAuthEnabled) {
      let previousSubject: string | null = null;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        const subject = session?.user.id ?? null;
        if (previousSubject !== subject) queryClient.clear();
        previousSubject = subject;
        setUser(session?.user ? toPortalUser(session.user) : null);
        setReady(true);
      });
      // Supabase emits INITIAL_SESSION after loading its persisted session.
      return () => subscription.unsubscribe();
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch {
      /* sessão inválida — ignora */
    }
    setReady(true);
    return undefined;
  }, [queryClient]);

  const signIn = useCallback(
    (next: SessionUser) => {
      if (localAuthEnabled) {
        queryClient.clear();
        setUser(next);
        return;
      }
      if (supabaseAuthEnabled) return; // The auth event above owns the session.
      queryClient.clear();
      setUser(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage indisponível */
      }
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    if (localAuthEnabled) await localAuth.signOut();
    if (supabaseAuthEnabled) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
    }
    queryClient.clear();
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage indisponível */
    }
  }, [queryClient]);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return ctx;
}

export const PERFIS: Perfil[] = ["Administrador", "Comercial", "Médico", "Custos"];

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
