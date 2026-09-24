import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localAuthEnabled } from "@/lib/data/local-api";
import { getTasyExportStatus, sendTasyExport } from "@/lib/data/tasy-export";
import { Button } from "@/components/ui/button";

export function TasyBudgetExport({ id }: { id: string }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = useQuery({
    queryKey: ["tasy-export", id],
    enabled: localAuthEnabled,
    retry: false,
    queryFn: () => getTasyExportStatus(id),
    refetchInterval: (query) =>
      ["queued", "sending"].includes(query.state.data?.state ?? "") ? 3000 : false,
  });
  if (!localAuthEnabled) return null;
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await sendTasyExport(id);
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
        A solicitação é enviada automaticamente ao Tasy ao ser criada, com os procedimentos,
        materiais e quantidades informados, como aguardando cotação.
      </p>
      {status.data?.state === "confirmed" ? (
        <p>Registrado no Tasy: {status.data.tasy_id} — aguardando cotação.</p>
      ) : (
        <>
          <p className="text-sm">
            A análise de Custos continua no portal. Revisões posteriores de itens e valores não
            alteram o registro inicial no Tasy.
          </p>
          {status.data?.state === "unknown" && (
            <p>
              Envio sem confirmação local. Use reconciliar para verificar ou concluir a mesma
              solicitação.
            </p>
          )}
          <Button
            type="button"
            disabled={
              busy ||
              status.isLoading ||
              !!status.error ||
              status.data?.state === "sending" ||
              status.data?.state === "queued"
            }
            onClick={() => void submit()}
          >
            {busy || status.data?.state === "sending" || status.data?.state === "queued"
              ? "Aguardando confirmação do Tasy…"
              : status.data
                ? "Reconciliar envio"
                : "Enviar ao Tasy para cotação"}
          </Button>
        </>
      )}
      {(error || status.error) && <p role="alert">{error || status.error?.message}</p>}
      <p className="text-xs text-muted-foreground">
        O registro inicial permanece aguardando cotação no Tasy. A aprovação e as revisões
        posteriores são realizadas no portal.
      </p>
    </section>
  );
}
