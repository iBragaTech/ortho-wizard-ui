import { useState } from "react";
import { MessageCircle, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth/session";
import { localAuthEnabled, portalCall } from "@/lib/data/local-api";
import { whatsappLink } from "@/lib/whatsapp";
import { canPrintQuote } from "@/lib/tasy-workflow";
import type { ConsultationRequest } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function BudgetWhatsApp({ request }: { request: ConsultationRequest }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{ file: File; hash: string; at: number } | null>(null);
  if (!localAuthEnabled || !["Médico", "Administrador"].includes(user?.perfil ?? "")) return null;
  const ready = request.status === "em_aprovacao" && canPrintQuote(request);
  const link = whatsappLink(phone, message);
  const file = prepared?.hash === request.tasyRetorno?.hash ? prepared?.file : undefined;
  const canShare =
    !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  function fresh() {
    if (!file || !ready || !prepared || Date.now() - prepared.at >= 120000) {
      setPrepared(null);
      toast.error("Prepare o PDF novamente para compartilhar os valores atualizados.");
      return false;
    }
    return true;
  }
  async function prepare() {
    setBusy(true);
    setPrepared(null);
    try {
      const hash = request.tasyRetorno?.hash;
      const result = await portalCall<{ filename: string; base64: string }>("getPatientQuotePdf", {
        id: request.id,
        hash,
      });
      const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
      setPrepared({
        file: new File([bytes], result.filename, { type: "application/pdf" }),
        hash: hash!,
        at: Date.now(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar o PDF.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!fresh() || !file) return;
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function share() {
    if (!fresh() || !file) return;
    try {
      await navigator.share({ files: [file], text: message, title: "Orçamento" });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Não foi possível compartilhar. Baixe o PDF e anexe na conversa.");
    }
  }
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Envio por WhatsApp</h2>
      <p className="text-sm text-muted-foreground">
        Envie o mesmo PDF de “Gerar arquivo do paciente”, com a mensagem preenchida no WhatsApp.
      </p>
      <Button
        size="sm"
        disabled={!ready}
        onClick={() => {
          setPhone(request.paciente.telefone === "—" ? "" : request.paciente.telefone || "");
          setMessage(
            `Olá, ${request.paciente.nome}! Segue seu orçamento ${request.numero}. Estamos à disposição para esclarecer suas dúvidas.`,
          );
          setPrepared(null);
          setOpen(true);
        }}
      >
        <MessageCircle className="size-4" /> Enviar por WhatsApp
      </Button>
      {!ready && (
        <p className="text-xs text-muted-foreground">
          Disponível com os valores revisados, na etapa Em aprovação.
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) {
            setOpen(next);
            if (!next) setPrepared(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar orçamento por WhatsApp</DialogTitle>
            <DialogDescription>
              Confira o telefone e a mensagem. O número informado aqui será usado apenas nesta
              conversa.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="whatsapp-phone">Telefone com DDD</Label>
          <Input
            id="whatsapp-phone"
            type="tel"
            autoComplete="tel"
            placeholder="(31) 99999-9999"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {phone && !link && (
            <p role="alert" className="text-sm text-destructive">
              Informe um telefone brasileiro válido com DDD (DDI +55 opcional).
            </p>
          )}
          <Label htmlFor="whatsapp-message">Mensagem</Label>
          <Textarea
            id="whatsapp-message"
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button
            disabled={busy || !ready || !link || !message.trim()}
            onClick={() => void prepare()}
          >
            {busy ? "Preparando PDF…" : file ? "Atualizar PDF" : "Preparar PDF"}
          </Button>
          {file && (
            <div className="grid gap-3 rounded-lg border p-3">
              <p className="text-sm">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                Baixe o PDF, abra a conversa e use o clipe do WhatsApp para anexar o arquivo. A
                mensagem e o anexo precisam ser enviados por você.
              </p>
              <Button variant="outline" onClick={download}>
                <Download className="size-4" /> Baixar PDF
              </Button>
              {link && message.trim() && (
                <Button asChild>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      if (!fresh()) event.preventDefault();
                    }}
                  >
                    <MessageCircle className="size-4" /> Abrir conversa em nova guia
                  </a>
                </Button>
              )}
              {canShare && (
                <>
                  <Button variant="outline" onClick={() => void share()}>
                    <Share2 className="size-4" /> Compartilhar PDF pelo aplicativo
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Selecione o WhatsApp e o contato na tela de compartilhamento do dispositivo.
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
