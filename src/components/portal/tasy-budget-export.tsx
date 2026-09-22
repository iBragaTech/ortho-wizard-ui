import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localAccessToken, localApiUrl, localAuthEnabled } from "@/lib/data/local-api";
import { Button } from "@/components/ui/button";

async function request<T>(id: string, post = false): Promise<T> {
  const response = await fetch(`${localApiUrl()}/v1/requests/${encodeURIComponent(id)}/tasy`, {
    method: post ? "POST" : "GET",
    headers: { Authorization: `Bearer ${localAccessToken() ?? ""}` },
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Falha no envio ao Tasy.");
  return body.data;
}
export function TasyBudgetExport({ id }: { id: string }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = useQuery({
    queryKey: ["tasy-export", id],
    enabled: localAuthEnabled,
    retry: false,
    queryFn: () =>
      request<{ state: string; tasy_id: string | null; error_code: string | null } | null>(id),
  });
  if (!localAuthEnabled) return null;
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await request(id, true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sem confirmação. Consulte o estado antes de reenviar.",
      );
    } finally {
      setBusy(false);
      await status.refetch();
      await client.invalidateQueries({ queryKey: ["timeline", id] });
    }
  }
  return (
    <section className="my-4 rounded-md border p-4 space-y-2">
      <h2 className="font-semibold">Registro no Tasy</h2>
      <p className="text-sm">
        Envia paciente já cadastrado, procedimentos e OPME como orçamento aguardando cotação, com
        quantidade 1 por item. Valores negociados ficam no histórico; este envio não calcula nem
        confirma os preços finais.
      </p>
      {status.data?.state === "confirmed" ? (
        <p>Registrado no Tasy: {status.data.tasy_id} — aguardando cotação.</p>
      ) : (
        <>
          <p className="text-sm">
            Após iniciar o envio, o orçamento fica bloqueado para edição. A reconciliação reutiliza
            o mesmo conteúdo para evitar duplicação.
          </p>
          {status.data && (
            <p>
              Envio sem confirmação local. Use reconciliar para verificar ou concluir a mesma
              solicitação.
            </p>
          )}
          <Button
            type="button"
            disabled={busy || status.isLoading || !!status.error}
            onClick={() => void submit()}
          >
            {busy
              ? "Processando…"
              : status.data
                ? "Reconciliar envio"
                : "Enviar ao Tasy para cotação"}
          </Button>
        </>
      )}
      {(error || status.error) && <p role="alert">{error || status.error?.message}</p>}
    </section>
  );
}
