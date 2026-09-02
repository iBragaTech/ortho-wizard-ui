// Hooks de leitura/escrita do portal. Todas as telas consomem o repositório
// através daqui — a origem dos dados pode mudar sem tocar na interface.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repository, type DoctorFeesInput, type InstitutionSettings, type NewRequestInput } from "./repository";

export function useRequests() {
  return useQuery({ queryKey: ["requests"], queryFn: () => repository.listRequests() });
}

export function useRequest(id: string) {
  return useQuery({ queryKey: ["requests", id], queryFn: () => repository.getRequest(id) });
}

export function useTimeline(id: string) {
  return useQuery({ queryKey: ["timeline", id], queryFn: () => repository.getTimeline(id) });
}

export function useDoctors() {
  return useQuery({ queryKey: ["doctors"], queryFn: () => repository.listDoctors() });
}

export function usePortalUsers() {
  return useQuery({ queryKey: ["portal_users"], queryFn: () => repository.listUsers() });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => repository.getSettings() });
}

function useInvalidateRequests() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["requests"] });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
  };
}

export function useCreateRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (input: NewRequestInput) => repository.createRequest(input),
    onSuccess: invalidate,
  });
}

export function useSaveDoctorFees() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DoctorFeesInput }) =>
      repository.saveDoctorFees(id, input),
    onSuccess: invalidate,
  });
}

export function useSaveHospitalValue() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: ({ id, valor, obs }: { id: string; valor: number | null; obs: string }) =>
      repository.saveHospitalValue(id, valor, obs),
    onSuccess: invalidate,
  });
}

export function useCreateDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; crm: string; especialidade: string }) =>
      repository.createDoctor(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["doctors"] }),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InstitutionSettings) => repository.saveSettings(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
