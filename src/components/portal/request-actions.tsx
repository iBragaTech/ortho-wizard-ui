import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/auth/session";
import { localAuthEnabled, portalCall } from "@/lib/data/local-api";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { telefonePessoaTasy } from "@/lib/data/tasy";
import type { ConsultationRequest } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function RequestActions({
  request,
  phoneOnly = false,
}: {
  request: ConsultationRequest;
  phoneOnly?: boolean;
}) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [action, setAction] = useState<"edit" | "deactivate" | "delete" | null>(null);
  const [phone, setPhone] = useState("");
  const [tasyPhone, setTasyPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [previous, setPrevious] = useState({ telefone: "", observacoes: "" });
  const [busy, setBusy] = useState(false);
  if (!localAuthEnabled || !user) return null;
  if (request.tasyGerenciado && !phoneOnly) return null;
  if (phoneOnly && !["Médico", "Administrador", "Comercial"].includes(user.perfil)) return null;
  const editPhoneOnly = phoneOnly || user.perfil === "Médico";
  async function open(next: typeof action) {
    setPhone(request.paciente.telefone);
    setNotes(request.observacoes);
    setPrevious({ telefone: request.paciente.telefone, observacoes: request.observacoes });
    setReason("");
    setAction(next);
    if (next === "edit" && editPhoneOnly && request.tasy?.cdPessoaFisica) {
      setBusy(true);
      try {
        const person = await getTasyClient().consultarPessoaFisica(request.tasy.cdPessoaFisica);
        const currentPhone = telefonePessoaTasy(person);
        setPhone(currentPhone);
        setTasyPhone(currentPhone);
      } catch (error) {
        setAction(null);
        toast.error(
          error instanceof Error ? error.message : "Não foi possível consultar o telefone no Tasy.",
        );
      } finally {
        setBusy(false);
      }
    } else setTasyPhone(request.paciente.telefone);
  }
  async function save() {
    setBusy(true);
    try {
      if (action === "edit" && editPhoneOnly)
        await portalCall("updatePatientPhone", {
          id: request.id,
          telefone: phone,
          anterior: previous.telefone,
          anteriorTasy: tasyPhone,
        });
      else if (action === "edit")
        await portalCall("editRequest", {
          id: request.id,
          telefone: phone,
          observacoes: notes,
          anterior: previous,
        });
      else
        await portalCall(action === "delete" ? "deleteRequest" : "deactivateRequest", {
          id: request.id,
          motivo: reason,
        });
      toast.success(
        action === "edit"
          ? editPhoneOnly
            ? "Telefone atualizado no portal e no Tasy."
            : "Orçamento atualizado."
          : action === "delete"
            ? "Orçamento excluído."
            : "Orçamento inativado.",
      );
      setAction(null);
      await cache.invalidateQueries({ queryKey: ["requests"] });
      await cache.invalidateQueries({ queryKey: ["timeline", request.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }
  const title =
    action === "edit"
      ? editPhoneOnly
        ? "Editar telefone"
        : "Editar orçamento"
      : action === "delete"
        ? "Excluir orçamento"
        : "Inativar orçamento";
  return (
    <>
      <div className="inline-flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => open("edit")}>
          {editPhoneOnly ? "Editar telefone" : "Editar"}
        </Button>
        {!phoneOnly && (
          <Button size="sm" variant="outline" onClick={() => open("deactivate")}>
            Inativar
          </Button>
        )}
        {!phoneOnly && user.perfil === "Administrador" && (
          <Button size="sm" variant="destructive" onClick={() => open("delete")}>
            Excluir
          </Button>
        )}
      </div>
      <Dialog
        open={!!action}
        onOpenChange={(next) => {
          if (!next && !busy) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {title} — {request.numero}
            </DialogTitle>
            <DialogDescription>
              {action === "edit"
                ? editPhoneOnly
                  ? "Informe o telefone com DDD. Ao salvar, o contato também será atualizado no Tasy."
                  : "Edite o telefone de contato e as observações deste orçamento. O telefone também será atualizado no Tasy."
                : action === "delete"
                  ? "O orçamento será removido da lista. Seu histórico será preservado para auditoria."
                  : "O orçamento sairá da lista de ativos e ficará bloqueado para alterações."}
            </DialogDescription>
          </DialogHeader>
          {action === "edit" ? (
            <>
              <Label htmlFor={`phone-${request.id}`}>Telefone</Label>
              <Input
                id={`phone-${request.id}`}
                type="tel"
                value={phone}
                maxLength={40}
                disabled={busy}
                onChange={(e) => setPhone(e.target.value)}
              />
              {!editPhoneOnly && (
                <>
                  <Label htmlFor={`notes-${request.id}`}>Observações</Label>
                  <Textarea
                    id={`notes-${request.id}`}
                    value={notes}
                    maxLength={8000}
                    disabled={busy}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Label htmlFor={`reason-${request.id}`}>Motivo</Label>
              <Textarea
                id={`reason-${request.id}`}
                value={reason}
                maxLength={500}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={action === "delete" ? "destructive" : "default"}
              disabled={busy || (action !== "edit" && reason.trim().length < 3)}
              onClick={() => void save()}
            >
              {busy ? "Salvando…" : action === "edit" ? "Salvar" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
