import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EquipeItem = { nome: string; quantidade: string };

export const equipeOptions = [
  "Fisioterapia",
  "Fonoaudiologia",
  "Terapia Ocupacional",
  "Nutrição",
  "Psicologia",
  "Serviço Social",
] as const;

type MultidisciplinarSelectProps = {
  id?: string;
  value: EquipeItem[];
  onChange: (value: EquipeItem[]) => void;
};

function onlyDigits(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function MultidisciplinarSelect({ id, value, onChange }: MultidisciplinarSelectProps) {
  const disponiveis = equipeOptions.filter((opcao) => !value.some((item) => item.nome === opcao));

  const adicionar = (nome: string) => {
    if (!nome || value.some((item) => item.nome === nome)) return;
    onChange([...value, { nome, quantidade: "" }]);
  };

  const remover = (nome: string) => onChange(value.filter((item) => item.nome !== nome));

  const definirQuantidade = (nome: string, quantidade: string) =>
    onChange(value.map((item) => (item.nome === nome ? { ...item, quantidade } : item)));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="rounded-md border bg-muted/30">
          {value.map((item, index) => (
            <div
              key={item.nome}
              className={`grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2 px-2 py-1.5 ${
                index > 0 ? "border-t" : ""
              }`}
            >
              <span className="truncate text-sm">{item.nome}</span>
              <Input
                inputMode="numeric"
                placeholder="Qtd."
                aria-label={`Quantidade de sessões de ${item.nome}`}
                className="h-8 text-right"
                value={item.quantidade}
                onChange={(e) => definirQuantidade(item.nome, onlyDigits(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`Remover ${item.nome}`}
                onClick={() => remover(item.nome)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {disponiveis.length > 0 && (
        <Select value="" onValueChange={adicionar}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Selecione um serviço para adicionar" />
          </SelectTrigger>
          <SelectContent>
            {disponiveis.map((opcao) => (
              <SelectItem key={opcao} value={opcao}>
                {opcao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
