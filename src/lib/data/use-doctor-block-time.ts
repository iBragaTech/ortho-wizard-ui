import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { localAuthEnabled } from "./local-api";
import { getTasyClient } from "./tasy-supabase";

export function useDoctorBlockTime({
  open,
  medical,
  procedureCode,
  initialValue = "",
}: {
  open: boolean;
  medical: boolean;
  procedureCode?: string | undefined;
  initialValue?: string;
}) {
  const { user } = useSession();
  const [manual, setManual] = useState<{ context: string; value: string } | null>(null);
  const context = `${user?.id ?? ""}:${procedureCode ?? ""}:${initialValue}`;
  const enabled =
    open &&
    medical &&
    localAuthEnabled &&
    !!procedureCode &&
    !!user &&
    ["Médico", "Administrador"].includes(user.perfil) &&
    !initialValue.trim();
  const query = useQuery({
    queryKey: ["doctor-block-time", user?.id, procedureCode],
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => getTasyClient().consultarTempoMedico(procedureCode!),
  });
  const minutes = enabled ? query.data?.minutos : null;
  const loading = enabled && query.isFetching;
  const readOnly = loading || (enabled && !query.error && minutes != null);
  const value =
    enabled && !query.error && minutes != null
      ? String(minutes)
      : manual?.context === context
        ? manual.value
        : initialValue;
  const hint = loading
    ? "Consultando o tempo médio do médico…"
    : !enabled
      ? "Informe o tempo em minutos."
      : query.error
        ? "Não foi possível consultar a média no Tasy. Informe o tempo em minutos."
        : minutes != null
          ? "Tempo médio deste médico para o procedimento principal, consultado no Tasy."
          : query.data?.motivo === "multiplas_medias"
            ? "Há mais de uma média no Tasy para este procedimento. Informe o tempo em minutos."
            : query.data?.motivo === "sem_medico"
              ? "Seu usuário Tasy não possui médico vinculado. Informe o tempo em minutos."
              : "Sem tempo médio cadastrado para este médico e procedimento. Informe os minutos.";
  return {
    value,
    loading,
    readOnly,
    hint,
    setValue: (value: string) => setManual({ context, value }),
    reset: () => setManual(null),
  };
}
