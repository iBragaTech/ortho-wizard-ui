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
    ["Médico", "Administrador"].includes(user.perfil);
  const query = useQuery({
    queryKey: ["doctor-block-time", user?.id, procedureCode],
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => getTasyClient().consultarTempoMedico(procedureCode!),
  });
  const minutes = enabled ? query.data?.minutos : null;
  const loading = enabled && query.isFetching;
  const readOnly = false;
  const value =
    manual?.context === context
      ? manual.value
      : initialValue.trim()
        ? initialValue
        : enabled && !query.error && minutes != null
          ? String(minutes)
          : initialValue;
  const warning =
    !loading &&
    !query.error &&
    minutes != null &&
    value.trim() &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0 &&
    Number(value) !== minutes
      ? `O tempo médio de cirurgia do médico ${user?.nome ?? ""} para este procedimento é de ${minutes} minutos. Você informou ${value} minutos. O tempo informado será mantido.`
      : null;
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
    warning,
    setValue: (value: string) => setManual({ context, value }),
    reset: () => setManual(null),
  };
}
