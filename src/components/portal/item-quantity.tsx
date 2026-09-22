import { Input } from "@/components/ui/input";

export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-red-600">
        {" "}
        *
      </span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  );
}

export function ItemQuantity({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid max-w-32 gap-1 text-sm">
      <span>
        Quantidade
        <RequiredMark />
      </span>
      <Input
        type="number"
        min={1}
        max={10000}
        step={1}
        required
        aria-label={`Quantidade de ${name}`}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isInteger(next) && next >= 1 && next <= 10000) onChange(next);
        }}
      />
    </label>
  );
}
