import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "./item-quantity";

type Item = { codigo: string; nome: string };
type Page = { items: Item[]; hasMore: boolean };
export function TasyInsuranceSelect({
  onChange,
}: {
  onChange: (convenio: string, categoria: string, cdConvenio: string, cdCategoria: string) => void;
}) {
  const particularCode = "29";
  const [categoryOffset, setCategoryOffset] = useState(0);
  const [category, setCategory] = useState("");
  const convenio = useQuery({
    queryKey: ["tasy", "convenio-particular", particularCode],
    retry: false,
    queryFn: () =>
      getTasyClient().executeOperation<Page>("catalogos.convenios", {
        busca: particularCode,
        offset: 0,
      }),
  });
  const categorias = useQuery({
    queryKey: ["tasy", "categorias", particularCode, categoryOffset],
    enabled: convenio.isSuccess,
    retry: false,
    queryFn: () =>
      getTasyClient().executeOperation<Page>("catalogos.categorias", {
        cdConvenio: particularCode,
        offset: categoryOffset,
      }),
  });
  const format = (item: Item) => `${item.codigo} - ${item.nome}`;
  const insurance = convenio.data?.items.find((item) => item.codigo === particularCode) ?? {
    codigo: particularCode,
    nome: "Particular",
  };
  const insuranceLabel = format(insurance);
  return (
    <div className="grid gap-3 sm:col-span-2">
      <Label htmlFor="convenio-tasy">
        Convênio do Tasy
        <RequiredMark />
      </Label>
      {convenio.error ? (
        <p role="alert">
          {convenio.error.message}{" "}
          <Button type="button" variant="outline" onClick={() => void convenio.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : (
        <>
          <select
            id="convenio-tasy"
            aria-label="Convênio do Tasy"
            className="w-full rounded-md border bg-background p-2"
            value={particularCode}
            disabled
          >
            <option value={particularCode}>
              {convenio.isFetching ? "Carregando…" : insuranceLabel}
            </option>
          </select>
        </>
      )}
      <Label htmlFor="categoria-tasy">
        Categoria do convênio
        <RequiredMark />
      </Label>
      {categorias.error ? (
        <p role="alert">
          {categorias.error.message}{" "}
          <Button type="button" variant="outline" onClick={() => void categorias.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : (
        <>
          <select
            id="categoria-tasy"
            className="w-full rounded-md border bg-background p-2"
            value={category}
            disabled={categorias.isFetching || !convenio.isSuccess}
            onChange={(e) => {
              setCategory(e.target.value);
              const item = categorias.data?.items.find((i) => format(i) === e.target.value);
              onChange(insuranceLabel, e.target.value, particularCode, item?.codigo ?? "");
            }}
          >
            <option value="">
              {categorias.isFetching ? "Carregando…" : "Selecione a categoria"}
            </option>
            {category && !categorias.data?.items.some((i) => format(i) === category) && (
              <option value={category}>{category}</option>
            )}
            {categorias.data?.items.map((item) => (
              <option key={item.codigo} value={format(item)}>
                {format(item)}
              </option>
            ))}
          </select>
          {categoryOffset > 0 || categorias.data?.hasMore ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!categoryOffset || categorias.isFetching}
                onClick={() => setCategoryOffset(categoryOffset - 100)}
              >
                Anteriores
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!categorias.data?.hasMore || categorias.isFetching}
                onClick={() => setCategoryOffset(categoryOffset + 100)}
              >
                Próximas
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
