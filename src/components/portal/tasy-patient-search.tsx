import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { isValidCpf, TasyApiError, type PessoaFisicaTasy } from "@/lib/data/tasy";

export function TasyPatientSearch({
  onSelect,
  onNotFound,
}: {
  onSelect: (person: PessoaFisicaTasy) => void;
  onNotFound?: (cpf: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [byCode, setByCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );

  async function search() {
    const value = query.trim().replace(/[.\-\s]/g, "");
    if (byCode ? !/^\d{1,10}$/.test(value) : !isValidCpf(value)) {
      toast.error(
        byCode ? "Informe o código do paciente no Tasy." : "Informe um CPF válido com 11 dígitos.",
      );
      return;
    }
    const current = ++revision.current;
    setBusy(true);
    try {
      const client = getTasyClient();
      const person = await (byCode
        ? client.consultarPessoaFisica(value)
        : client.buscarPessoaFisicaPorCpf(value));
      if (current !== revision.current) return;
      onSelect(person);
      toast.success("Dados do paciente preenchidos a partir do Tasy. Confira antes de salvar.");
    } catch (error) {
      if (
        current === revision.current &&
        !byCode &&
        error instanceof TasyApiError &&
        error.code === "NOT_FOUND"
      ) {
        onNotFound?.(value);
        toast.info("CPF não encontrado. Preencha os campos para cadastrar a pessoa no Tasy.");
      } else if (current === revision.current)
        toast.error(
          error instanceof Error ? error.message : "Não foi possível consultar o paciente.",
        );
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <Label htmlFor="tasy-patient-query">Buscar paciente no Tasy</Label>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Buscar por"
          className="rounded-md border bg-background px-2"
          disabled={busy}
          value={byCode ? "codigo" : "cpf"}
          onChange={(event) => {
            setByCode(event.target.value === "codigo");
            setQuery("");
          }}
        >
          <option value="cpf">CPF</option>
          <option value="codigo">Código Tasy</option>
        </select>
        <Input
          id="tasy-patient-query"
          className="min-w-40 flex-1"
          inputMode="numeric"
          value={query}
          disabled={busy}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!busy) void search();
            }
          }}
        />
        <Button type="button" disabled={busy} onClick={() => void search()}>
          {busy ? "Consultando…" : "Buscar"}
        </Button>
      </div>
    </div>
  );
}
