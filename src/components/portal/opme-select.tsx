import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { listOpmeItems } from "@/data/opme-catalog";

export function OpmeSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => listOpmeItems(), []);
  const selected = value.map(
    (code) => items.find((i) => i.codigo === code) ?? { codigo: code, descricao: code, fornecedor: "Digitado manualmente", custom: true as const },
  );

  function toggle(codigo: string) {
    onChange(value.includes(codigo) ? value.filter((c) => c !== codigo) : [...value, codigo]);
  }

  const trimmed = query.trim();
  const canAddCustom =
    trimmed.length > 0 &&
    !items.some((i) => `${i.codigo} ${i.descricao} ${i.fornecedor}`.toLowerCase() === trimmed.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  function addCustom() {
    if (!canAddCustom) return;
    onChange([...value, trimmed]);
    setQuery("");
  }

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
            <span className="truncate text-left">
              {selected.length === 0
                ? "Pesquisar item de OPME..."
                : `${selected.length} item(ns) selecionado(s)`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Buscar ou digitar um item de OPME..."
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
                  "Nenhum item encontrado."
                )}
              </CommandEmpty>
              {canAddCustom ? (
                <CommandGroup heading="Item digitado">
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
                    value={`${item.codigo} ${item.descricao} ${item.fornecedor}`}
                    onSelect={() => toggle(item.codigo)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value.includes(item.codigo) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{item.descricao}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.codigo} · {item.fornecedor}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <Badge key={item.codigo} variant="secondary" className="max-w-full gap-1 py-1">
              <span className="truncate">
                {item.codigo} · {item.descricao}
              </span>
              <button
                type="button"
                aria-label={`Remover ${item.descricao}`}
                onClick={() => toggle(item.codigo)}
                className="rounded-full p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function formatOpmeSelection(codes: string[]): string {
  const items = listOpmeItems();
  return codes
    .map((c) => {
      const item = items.find((i) => i.codigo === c);
      return item ? `${item.codigo} - ${item.descricao} (${item.fornecedor})` : c;
    })
    .join("; ");
}
