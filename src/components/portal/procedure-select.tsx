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
import { listProcedures } from "@/data/procedure-catalog";

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
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => listProcedures(), []);
  const selected = value.map(
    (code) =>
      items.find((i) => i.codigo === code) ?? {
        codigo: code,
        descricao: code,
        porte: undefined,
        custom: true as const,
      },
  );

  function toggle(codigo: string) {
    if (!multiple) {
      onChange(value.includes(codigo) ? [] : [codigo]);
      setOpen(false);
      return;
    }
    onChange(value.includes(codigo) ? value.filter((c) => c !== codigo) : [...value, codigo]);
  }

  const trimmed = query.trim();
  const canAddCustom =
    trimmed.length > 0 &&
    !items.some((i) => `${i.codigo} ${i.descricao}`.toLowerCase() === trimmed.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  function addCustom() {
    if (!canAddCustom) return;
    onChange(multiple ? [...value, trimmed] : [trimmed]);
    setQuery("");
    if (!multiple) setOpen(false);
  }

  const label =
    selected.length === 0
      ? placeholder
      : multiple
        ? `${selected.length} procedimento(s) selecionado(s)`
        : `${selected[0]!.codigo} · ${selected[0]!.descricao}`;

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

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <Badge key={item.codigo} variant="secondary" className="max-w-full gap-1 py-1">
              <span className="truncate">
                {"custom" in item ? item.descricao : `${item.codigo} · ${item.descricao}`}
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
