import { ItemQuantity } from "./item-quantity";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TasyPriceReference } from "./tasy-price-reference";

export type TasyProcedureItem = {
  quantidade?: number;
  codigo: string;
  nome: string;
  origem: string;
};
export function TasyProcedureSelect({
  value,
  onChange,
  cdConvenio,
  cdCategoria,
  multiple = false,
}: {
  cdConvenio: string;
  cdCategoria: string;
  multiple?: boolean;
  value: TasyProcedureItem[];
  onChange: (items: TasyProcedureItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const searchArea = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["tasy", "procedimentos", cdConvenio, cdCategoria, search, offset],
    enabled: search !== null && !!cdConvenio && !!cdCategoria,
    retry: false,
    queryFn: () =>
      getTasyClient().executeOperation<{ items: TasyProcedureItem[]; hasMore: boolean }>(
        "catalogos.procedimentos",
        { busca: search, offset, cdConvenio, cdCategoria },
      ),
  });
  function find() {
    if (!cdConvenio || !cdCategoria) return;
    const normalized = draft.trim();
    setOffset(0);
    setSearch(normalized);
    if (search === normalized && offset === 0) void query.refetch();
  }
  function toggle(item: TasyProcedureItem) {
    const alreadySelected = value.some((v) => v.codigo === item.codigo && v.origem === item.origem);
    onChange(
      alreadySelected
        ? value.filter((v) => v.codigo !== item.codigo || v.origem !== item.origem)
        : multiple
          ? [...value, item]
          : [item],
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
          aria-label="Pesquisar procedimentos no Tasy"
          placeholder="Nome ou código do procedimento"
          maxLength={80}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              find();
            }
          }}
        />
        <Button
          type="button"
          onClick={find}
          disabled={query.isFetching || !cdConvenio || !cdCategoria}
        >
          Buscar
        </Button>
      </div>
      {query.isFetching && <p role="status">Consultando procedimentos…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {!query.isFetching && query.data && (
        <>
          {!query.data.items.length && <p>Nenhum procedimento encontrado.</p>}
          {query.data.items.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-md border p-2">
              {query.data.items.map((item) => (
                <label
                  key={`${item.codigo}:${item.origem}`}
                  className="flex items-start gap-2 py-2"
                >
                  <input
                    type="checkbox"
                    checked={value.some(
                      (v) => v.codigo === item.codigo && v.origem === item.origem,
                    )}
                    onChange={() => toggle(item)}
                  />
                  <span className="text-sm">
                    {item.codigo} - {item.nome}
                    <span className="block text-xs text-muted-foreground">
                      Origem {item.origem}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {(offset > 0 || query.data.hasMore) && (
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
          )}
        </>
      )}
      {value.map((item) => (
        <div
          key={`${item.codigo}:${item.origem}`}
          className="flex flex-wrap items-center gap-3 text-sm"
        >
          <span className="min-w-48 flex-1">
            {item.codigo} - {item.nome}
          </span>
          <ItemQuantity
            inline
            name={item.nome}
            value={item.quantidade ?? 1}
            onChange={(quantidade) =>
              onChange(
                value.map((v) =>
                  v.codigo === item.codigo && v.origem === item.origem ? { ...v, quantidade } : v,
                ),
              )
            }
          />
          <TasyPriceReference
            codigo={item.codigo}
            origem={item.origem}
            cdConvenio={cdConvenio}
            cdCategoria={cdCategoria}
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
    </div>
  );
}
