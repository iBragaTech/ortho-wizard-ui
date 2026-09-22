import type { User } from "@supabase/supabase-js";
import type { SessionUser } from "./session";

// Explicit migration switch: existing demo logins are not Supabase Auth users.
export const supabaseAuthEnabled = import.meta.env["VITE_PORTAL_AUTH_MODE"] === "supabase";

export function toPortalUser(user: User): SessionUser | null {
  // app_metadata is administered by the backend. Never take a role from user_metadata.
  const perfil: unknown = user.app_metadata["portal_perfil"];
  if (perfil !== "Administrador" && perfil !== "Comercial" && perfil !== "Médico") return null;
  return {
    id: user.id,
    nome:
      typeof user.user_metadata["nome"] === "string"
        ? user.user_metadata["nome"]
        : (user.email ?? "Usuário"),
    email: user.email ?? "",
    perfil,
  };
}
