import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  listProcedures,
  type ProcedureSelectionItem,
} from "@/data/procedure-catalog";
import { ItemQuantity } from "./item-quantity";

/**
 * Seleção de procedimentos com busca, mesma mecânica do OPME:
 * itens do catálogo (futuramente vindos do banco corporativo) e texto livre.
 * `multiple = false` mantém apenas um item (procedimento principal).
 */
export function ProcedureSelect({
  value,
  onChange,
  multiple = false,
  placeholder = "Pesquisar procedimento...",
}: {
  value: ProcedureSelectionItem[];
  onChange: (value: ProcedureSelectionItem[]) => void;
  multiple?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => listProcedures(), []);
  function toggle(item: ProcedureSelectionItem) {
    const selected = value.some((current) => current.codigo === item.codigo);
    if (!multiple) {
      onChange(selected ? [] : [item]);
      setOpen(false);
      return;
    }
    onChange(selected ? value.filter((current) => current.codigo !== item.codigo) : [...value, item]);
  }

  const trimmed = query.trim();
  const canAddCustom =
    trimmed.length > 0 &&
    !items.some((i) => `${i.codigo} ${i.descricao}`.toLowerCase() === trimmed.toLowerCase()) &&
    !value.some((item) => item.nome.toLowerCase() === trimmed.toLowerCase());

  function addCustom() {
    if (!canAddCustom) return;
    const item: ProcedureSelectionItem = {
      codigo: trimmed,
      nome: trimmed,
      quantidade: 1,
      origem: "digitado",
    };
    onChange(multiple ? [...value, item] : [item]);
    setQuery("");
    if (!multiple) setOpen(false);
  }

  const label =
    value.length === 0
      ? placeholder
      : multiple
        ? `${value.length} procedimento(s) selecionado(s)`
        : `${value[0]?.codigo} · ${value[0]?.nome}`;

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate text-left">{label}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar ou digitar um procedimento..."
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAddCustom) {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {trimmed ? (
                  <button
                    type="button"
                    onClick={addCustom}
                    className="mx-auto flex items-center gap-2 rounded-md px-2 py-1 text-sm text-primary hover:underline"
                  >
                    <Plus className="h-4 w-4" /> Adicionar "{trimmed}"
                  </button>
                ) : (
                  "Nenhum procedimento encontrado."
                )}
              </CommandEmpty>
              {canAddCustom ? (
                <CommandGroup heading="Procedimento digitado">
                  <CommandItem value={`__custom__ ${trimmed}`} onSelect={addCustom}>
                    <Plus className="h-4 w-4" />
                    <span className="truncate">Adicionar "{trimmed}"</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup heading="Catálogo">
                {items.map((item) => (
                  <CommandItem
                    key={item.codigo}
                    value={`${item.codigo} ${item.descricao}`}
                    onSelect={() =>
                      toggle({
                        codigo: item.codigo,
                        nome: item.descricao,
                        quantidade: 1,
                        origem: "catalogo",
                      })
                    }
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value.some((current) => current.codigo === item.codigo)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{item.descricao}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.codigo}
                        {item.porte ? ` · Porte ${item.porte}` : ""}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <div>
          {value.map((item) => (
            <div
              key={`${item.origem}:${item.codigo}`}
              className="grid items-center gap-3 border-b py-2 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_5rem_auto]"
            >
              <span className="min-w-0 break-words">
                {item.codigo === item.nome ? item.nome : `${item.codigo} - ${item.nome}`}
              </span>
              <ItemQuantity
                inline
                name={item.nome}
                value={item.quantidade}
                onChange={(quantidade) =>
                  onChange(
                    value.map((current) =>
                      current.codigo === item.codigo ? { ...current, quantidade } : current,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                className="justify-self-start sm:justify-self-end"
                aria-label={`Remover ${item.nome}`}
                onClick={() => toggle(item)}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
