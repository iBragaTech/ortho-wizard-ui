import { Input } from "@/components/ui/input";
import { RequiredMark } from "./item-quantity";

export type TasyUserLink = {
  nmUsuario: string;
  cdPerfil: number;
  cdEstabelecimento: number;
  consultarTodosPacientes: boolean;
  cadastrarPacientes: boolean;
};
export function TasyUserFields({
  value,
  onChange,
}: {
  value: TasyUserLink;
  onChange: (v: TasyUserLink) => void;
}) {
  return (
    <fieldset className="grid gap-3 rounded border p-3">
      <legend className="px-1 text-sm font-medium">Vínculo com o Tasy</legend>
      <label className="grid gap-1 text-sm">
        Usuário Tasy (NM_USUARIO)
        <RequiredMark />
        <Input
          required
          maxLength={15}
          autoComplete="off"
          value={value.nmUsuario}
          onChange={(e) => onChange({ ...value, nmUsuario: e.target.value })}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Código do perfil Tasy
        <RequiredMark />
        <Input
          type="number"
          min={1}
          step={1}
          required
          value={value.cdPerfil || ""}
          onChange={(e) => onChange({ ...value, cdPerfil: Number(e.target.value) })}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Código do estabelecimento
        <RequiredMark />
        <Input
          type="number"
          min={1}
          step={1}
          required
          value={value.cdEstabelecimento || ""}
          onChange={(e) => onChange({ ...value, cdEstabelecimento: Number(e.target.value) })}
        />
      </label>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.consultarTodosPacientes}
          onChange={(e) => onChange({ ...value, consultarTodosPacientes: e.target.checked })}
        />
        Permitir consulta de pacientes para orçamentos
      </label>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.cadastrarPacientes}
          onChange={(e) => onChange({ ...value, cadastrarPacientes: e.target.checked })}
        />
        Permitir cadastro de novos pacientes no Tasy
      </label>
      <p className="text-xs text-muted-foreground">
        O usuário e o perfil serão validados no Tasy. A senha de acesso ao portal é independente da
        senha do Tasy.
      </p>
    </fieldset>
  );
}
