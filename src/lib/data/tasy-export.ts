import { localAccessToken, localApiUrl } from "./local-api";

export type TasyExportStatus = {
  state: "queued" | "sending" | "unknown" | "confirmed";
  tasy_id: string | null;
  error_code: string | null;
  mode: string | null;
};

async function request<T>(id: string, post = false): Promise<T> {
  const response = await fetch(`${localApiUrl()}/v1/requests/${encodeURIComponent(id)}/tasy`, {
    method: post ? "POST" : "GET",
    headers: { Authorization: `Bearer ${localAccessToken() ?? ""}` },
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(180000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Falha no envio ao Tasy.");
  return body.data;
}
export const getTasyExportStatus = (id: string) => request<TasyExportStatus | null>(id);
export const sendTasyExport = (id: string) => request<{ nrOrcamento: string }>(id, true);
