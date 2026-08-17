import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doctors, especialidades, statusLabels, type RequestStatus } from "@/data/mock";

export interface Filters {
  busca: string;
  status: string;
  medico: string;
  especialidade: string;
  periodo: string;
}

export function SearchAndFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const set = (key: keyof Filters) => (value: string) => onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.busca}
            onChange={(e) => set("busca")(e.target.value)}
            placeholder="Buscar por paciente ou número..."
            className="pl-9"
          />
        </div>

        <Select value={filters.status} onValueChange={set("status")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(statusLabels) as RequestStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.medico} onValueChange={set("medico")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Médico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os médicos</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.nome}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.especialidade} onValueChange={set("especialidade")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas especialidades</SelectItem>
            {especialidades.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.periodo} onValueChange={set("periodo")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="todos">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
