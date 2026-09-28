import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import type { ConsultationRequest } from "@/data/mock";
import { useSession } from "@/lib/auth/session";
import { localAuthEnabled, portalCall } from "@/lib/data/local-api";
import { canPrintQuote } from "@/lib/tasy-workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Entry = {
  id: string;
  kind: "new_request" | "patient_quote";
  recipient: string;
  state: "queued" | "sending" | "sent" | "failed" | "unknown";
  error_code: string | null;
};
const labels = {
  queued: "Na fila de envio",
  sending: "Enviando…",
  sent: "Aceito pelo servidor de e-mail",
  failed: "Falha no envio",
  unknown: "Envio sem confirmação — confira antes de repetir",
};

export function BudgetEmail({ request }: { request: ConsultationRequest }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: ["budget-emails", request.id],
    enabled: localAuthEnabled,
    queryFn: () =>
      portalCall<{ enabled: boolean; messages: Entry[] }>("getRequestEmails", { id: request.id }),
    refetchInterval: 5000,
  });
  const canSend =
    ["Médico", "Administrador"].includes(user?.perfil ?? "") && request.status === "em_aprovacao";
  async function refresh() {
    await Promise.all([
      status.refetch(),
      cache.invalidateQueries({ queryKey: ["timeline", request.id] }),
    ]);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await portalCall<{ state: Entry["state"] }>("sendPatientQuote", {
        id: request.id,
        email: email.trim(),
        hash: request.tasyRetorno?.hash,
      });
      if (result.state === "failed" || result.state === "unknown")
        toast.error(labels[result.state]);
      else
        toast.success(
          result.state === "sent"
            ? "Este orçamento já foi enviado para esse endereço."
            : "Orçamento na fila de envio. Acompanhe o resultado abaixo.",
        );
      setOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar o envio.");
    } finally {
      setBusy(false);
    }
  }
  async function retry(entry: Entry) {
    setBusy(true);
    try {
      await portalCall("retryRequestEmail", { id: request.id, emailId: entry.id });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao solicitar nova tentativa.");
    } finally {
      setBusy(false);
    }
  }
  if (!localAuthEnabled) return null;
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Envio por e-mail</h2>
      {status.error && (
        <p role="alert" className="text-sm">
          Não foi possível consultar os envios.
        </p>
      )}
      {status.data?.enabled === false && (
        <p className="text-sm text-muted-foreground">Envio de e-mails ainda não configurado.</p>
      )}
      {canSend && (
        <Button
          size="sm"
          disabled={!status.data?.enabled || !canPrintQuote(request) || busy}
          onClick={() => {
            setEmail(request.paciente.email === "—" ? "" : request.paciente.email || "");
            setOpen(true);
          }}
        >
          <Mail className="h-4 w-4" />
          Enviar orçamento ao paciente
        </Button>
      )}
      {status.data?.messages.map((entry) => (
        <div key={entry.id} className="border-t pt-3 text-sm space-y-1">
          <p className="font-medium">
            {entry.kind === "new_request" ? "Notificação de novo orçamento" : "Orçamento em PDF"}
          </p>
          <p className="break-all">{entry.recipient}</p>
          <p role="status">{labels[entry.state]}</p>
          {entry.error_code === "QUOTE_CHANGED" && (
            <p>O orçamento mudou. Atualize a página e solicite um novo envio.</p>
          )}
          {entry.state === "failed" &&
            entry.error_code !== "QUOTE_CHANGED" &&
            (entry.kind === "new_request" ? user?.perfil === "Administrador" : canSend) && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void retry(entry)}>
                Tentar novamente
              </Button>
            )}
        </div>
      ))}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent>
          <form onSubmit={send}>
            <DialogHeader>
              <DialogTitle>Enviar orçamento ao paciente</DialogTitle>
              <DialogDescription>
                O orçamento atualizado será enviado em PDF. Confira o destinatário antes de enviar.
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-2">
              <Label htmlFor="quote-recipient">E-mail do paciente</Label>
              <Input
                id="quote-recipient"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Alterar este endereço afeta apenas este envio e não muda o cadastro do paciente.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !email.trim()}>
                {busy ? "Solicitando envio…" : "Enviar PDF por e-mail"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
