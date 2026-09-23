import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { getTasyClient } from "@/lib/data/tasy-supabase";
import { formatCurrency } from "@/data/mock";
export function TasyPriceReference({
  codigo,
  origem,
  cdConvenio,
  cdCategoria,
}: {
  codigo: string;
  origem?: string;
  cdConvenio: string;
  cdCategoria: string;
}) {
  const { user } = useSession();
  const visible = user?.perfil === "Custos" || user?.perfil === "Administrador";
  const query = useQuery({
    queryKey: ["tasy-price", user?.id, cdConvenio, cdCategoria, codigo, origem],
    enabled: visible && !!cdConvenio && !!cdCategoria,
    retry: false,
    staleTime: 60000,
    queryFn: () =>
      getTasyClient().executeOperation<{
        valorProcedimento?: number | null;
        valorMaterial?: number | null;
      }>(origem ? "precos.procedimento" : "precos.material", {
        codigo,
        ...(origem ? { origem } : {}),
        cdConvenio,
        cdCategoria,
      }),
  });
  if (!visible) return null;
  const amount = query.data?.valorProcedimento ?? query.data?.valorMaterial;
  return (
    <div className="min-w-28 text-sm" aria-live="polite">
      <div className="text-xs text-muted-foreground">Valor unitário</div>
      <div>
        {query.isFetching
          ? "Consultando..."
          : query.error
            ? "Consulta indisponível"
            : amount == null
              ? "Preço pendente"
              : formatCurrency(amount)}
      </div>
    </div>
  );
}
