import { ItemQuantity } from "./item-quantity";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TasyMaterialItem = {
  quantidade?: number;
  codigo: string;
  nome: string;
  grupo: string | null;
};

export function TasyMaterialSelect({
  value,
  onChange,
}: {
  value: TasyMaterialItem[];
  onChange: (items: TasyMaterialItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const searchArea = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["tasy", "materiais", search, offset],
    enabled: search !== null,
    retry: false,
    queryFn: () =>
      getTasyClient().executeOperation<{ items: TasyMaterialItem[]; hasMore: boolean }>(
        "catalogos.materiais",
        { busca: search, offset },
      ),
  });
  function find() {
    const normalized = draft.trim();
    setOffset(0);
    setSearch(normalized);
    if (search === normalized && offset === 0) void query.refetch();
  }
  function toggle(item: TasyMaterialItem) {
    const alreadySelected = value.some((selected) => selected.codigo === item.codigo);
    onChange(
      alreadySelected
        ? value.filter((selected) => selected.codigo !== item.codigo)
        : [...value, item],
    );
    if (!alreadySelected) {
      setDraft("");
      setSearch(null);
      setOffset(0);
      requestAnimationFrame(() =>
        searchArea.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }
  return (
    <div className="grid gap-2">
      <div ref={searchArea} className="flex gap-2">
        <Input
          aria-label="Pesquisar materiais no Tasy"
          placeholder="Nome ou código do material"
          maxLength={80}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              find();
            }
          }}
        />
        <Button type="button" onClick={find} disabled={query.isFetching}>
          Buscar
        </Button>
      </div>
      {query.isFetching && <p role="status">Consultando materiais…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {!query.isFetching && query.data && (
        <>
          {!query.data.items.length && <p>Nenhum material encontrado.</p>}
          <div className="max-h-56 overflow-y-auto rounded-md border p-2">
            {query.data.items.map((item) => (
              <label key={item.codigo} className="flex items-start gap-2 py-2">
                <input
                  type="checkbox"
                  checked={value.some((selected) => selected.codigo === item.codigo)}
                  onChange={() => toggle(item)}
                />
                <span className="text-sm">
                  {item.codigo} - {item.nome}
                  <span className="block text-xs text-muted-foreground">{item.grupo}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(offset - 100)}
            >
              Anteriores
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!query.data.hasMore}
              onClick={() => setOffset(offset + 100)}
            >
              Próximos
            </Button>
          </div>
        </>
      )}
      {value.map((item) => (
        <div key={item.codigo} className="flex items-center justify-between gap-2 text-sm">
          <span>
            {item.codigo} - {item.nome}
          </span>
          <ItemQuantity
            name={item.nome}
            value={item.quantidade ?? 1}
            onChange={(quantidade) =>
              onChange(value.map((v) => (v.codigo === item.codigo ? { ...v, quantidade } : v)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            aria-label={`Remover ${item.nome}`}
            onClick={() => toggle(item)}
          >
            Remover
          </Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Materiais ativos do Tasy, exceto os grupos reservados para OPME.
      </p>
    </div>
  );
}
