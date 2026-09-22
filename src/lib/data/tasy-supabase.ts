import { supabase } from "@/integrations/supabase/client";
import { createTasyClient } from "./tasy";
import { supabaseAuthEnabled } from "@/lib/auth/supabase-auth";
import { localAuthEnabled, localAccessToken, localApiUrl } from "./local-api";

// Instantiate only when the integration is configured. No database credentials
// or service-role keys belong in the frontend.
export function createSupabaseTasyClient(baseUrl: string) {
  return createTasyClient({
    baseUrl,
    getAccessToken: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error("Não foi possível recuperar a sessão.");
      return data.session?.access_token ?? null;
    },
  });
}

export function getTasyClient() {
  if (localAuthEnabled) {
    return createTasyClient({
      baseUrl: localApiUrl(),
      getAccessToken: async () => localAccessToken(),
    });
  }
  const baseUrl = import.meta.env["VITE_TASY_API_URL"];
  if (!supabaseAuthEnabled || !baseUrl) {
    throw new Error("Integração Tasy não configurada.");
  }
  return createSupabaseTasyClient(baseUrl);
}
