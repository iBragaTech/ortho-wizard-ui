import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PortalUser } from "@/data/mock";
import { portalCall } from "@/lib/data/local-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { TasyUserFields, type TasyUserLink } from "./tasy-user-fields";

export function UserTasyLinkDialog({ user }: { user: PortalUser }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const initial = (): TasyUserLink => ({
    nmUsuario: user.nmUsuario ?? "",
    cdPerfil: user.cdPerfil ?? 0,
    cdEstabelecimento: user.cdEstabelecimento ?? 2,
    consultarTodosPacientes: user.consultarTodosPacientes ?? false,
    cadastrarPacientes: user.cadastrarPacientes ?? false,
  });
  const [value, setValue] = useState(initial);
  const cache = useQueryClient();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(initial());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Vínculo Tasy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vínculo Tasy — {user.nome}</DialogTitle>
          <DialogDescription>
            Defina o usuário, perfil e acesso a pacientes. A alteração ficará registrada na
            auditoria.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await portalCall("saveUserTasyLink", { id: user.id, ...value });
              await cache.invalidateQueries({ queryKey: ["portal_users"] });
              setOpen(false);
              toast.success("Vínculo Tasy validado e salvo.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <TasyUserFields value={value} onChange={setValue} />
          <Button type="submit" disabled={busy}>
            {busy ? "Validando no Tasy…" : "Validar e salvar vínculo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
