import type { SessionUser } from "@/lib/auth/session";

export const localAuthEnabled = import.meta.env["VITE_PORTAL_AUTH_MODE"] === "local";
export const localAuthEvent = "portal-local-auth-changed";
const tokenKey = "portal.local.access-token";
export function localAccessToken(): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(tokenKey);
}
function saveToken(token: string | null) {
  if (token) sessionStorage.setItem(tokenKey, token);
  else sessionStorage.removeItem(tokenKey);
  window.dispatchEvent(new Event(localAuthEvent));
}
export function localApiUrl() {
  const value = import.meta.env["VITE_PORTAL_API_URL"];
  if (!value) throw new Error("Endereço da API do portal não configurado.");
  const url = new URL(value);
  const allowPrivateHttp = import.meta.env["VITE_PORTAL_ALLOW_PRIVATE_HTTP"] === "true";
  const privateHostname =
    /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/.test(
      url.hostname,
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
          (allowPrivateHttp && privateHostname))
      ))
  ) {
    throw new Error("A API exige HTTPS, exceto em desenvolvimento local.");
  }
  return value.replace(/\/+$/, "");
}
async function call<T>(path: string, body?: unknown): Promise<T> {
  const token = localAccessToken();
  const response = await fetch(`${localApiUrl()}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(
      path.includes("/v1/portal/createRequest") || path.includes("/v1/portal/calculateRequest")
        ? 180000
        : 30000,
    ),
  });
  if (response.status === 401 && token && path !== "/v1/auth/login") saveToken(null);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Falha ao acessar a API.");
  return result.data as T;
}
export const localAuth = {
  signIn: async (email: string, senha: string): Promise<SessionUser> => {
    const result = await call<{ token: string; user: SessionUser }>("/v1/auth/login", {
      email,
      senha,
    });
    saveToken(result.token);
    return result.user;
  },
  currentUser: async (): Promise<SessionUser | null> =>
    localAccessToken() ? call<SessionUser>("/v1/auth/me") : null,
  signOut: async () => {
    if (localAccessToken()) await call("/v1/auth/logout", {});
    saveToken(null);
  },
};
export const portalCall = <T>(operation: string, input: unknown = {}) =>
  call<T>(`/v1/portal/${encodeURIComponent(operation)}`, input);
