// Client for the separate hospital API. Supply a real access token issued for
// that API. The existing portal.session object is NOT an authentication token.
export class TasyApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "TasyApiError";
  }
}

export interface PessoaFisicaTasy {
  cdPessoaFisica: string;
  nmPessoaFisica: string | null;
  dtNascimento: string | null;
  nrCpf: string | null;
  nrTelefoneCelular: string | null;
  nrDddCelular: string | null;
  nrDdiCelular: string | null;
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
<<<<<<< HEAD
  if (!/^\d{11}$/.test(digits) || /^\d{11}$/.test((digits[0] ?? "").repeat(11))) return false;
  let sum = 0;
  for (let index = 0; index < 9; index++) sum += Number(digits[index]) * (10 - index);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits[9])) return false;
  sum = 0;
  for (let index = 0; index < 10; index++) sum += Number(digits[index]) * (11 - index);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(digits[10]);
=======
  return /^\d{11}$/.test(digits) && !/^(\d)\1{10}$/.test(digits);
>>>>>>> d1ce128 (Modificações usuarios)
}

// Preserve a complete/formatted number as stored; add area code only to a local number.
export function telefonePessoaTasy(person: PessoaFisicaTasy): string {
  const phone = person.nrTelefoneCelular?.trim() ?? "";
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const area = person.nrDddCelular?.trim() ?? "";
  if (/^\d{2}$/.test(area) && /^\d{8,9}$/.test(digits) && !phone.startsWith("+")) {
    const country = person.nrDdiCelular?.trim() ?? "";
    return `${/^\d{1,3}$/.test(country) ? `+${country} ` : ""}(${area}) ${phone}`;
  }
  return phone;
}

export type SalvarPessoaFisicaTasy = {
  nmPessoaFisica: string;
  dtNascimento: string;
  nrCpf: string;
} & (
  | { cdPessoaFisica?: never; anterior?: never }
  | {
      cdPessoaFisica: string;
      anterior: Pick<PessoaFisicaTasy, "nmPessoaFisica" | "dtNascimento" | "nrCpf">;
    }
);

export function createTasyClient(options: {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const url = new URL(options.baseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const privateNetwork =
    /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/.test(
      url.hostname,
    );
  const allowPrivateHttp = import.meta.env["VITE_PORTAL_ALLOW_PRIVATE_HTTP"] === "true";
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && (local || (allowPrivateHttp && privateNetwork)))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("A API Tasy requer uma URL HTTPS sem credenciais.");
  }
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function executeOperation<T>(operation: string, input: unknown): Promise<T> {
    if (!/^[a-z][a-z0-9.-]{0,79}$/.test(operation)) {
      throw new Error("Nome de operação inválido.");
    }
    const token = await options.getAccessToken();
    if (!token) throw new TasyApiError("UNAUTHORIZED", "Autentique-se para acessar o Tasy.");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/operations/${encodeURIComponent(operation)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      // A failed HTTP response does not prove that a write was rolled back.
      throw new TasyApiError(
        "RESULT_UNKNOWN",
        "Sem confirmação da API. Se houve gravação, confira o resultado no Tasy antes de repetir.",
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new TasyApiError(
        "INVALID_RESPONSE",
        "Resposta sem confirmação. Confira o resultado no Tasy antes de repetir uma gravação.",
      );
    }
    if (!response.ok) {
      throw new TasyApiError(
        payload.error?.code ?? "REQUEST_FAILED",
        payload.error?.message ?? "Falha na integração com o Tasy.",
        payload.requestId,
      );
    }
    return payload.data as T;
  }

  return {
    consultarUsuario: (nmUsuario: string) =>
      executeOperation<{ nmUsuario: string }>("usuarios.consultar", { nmUsuario }),
    consultarPessoaFisica: (cdPessoaFisica: string) =>
      executeOperation<PessoaFisicaTasy>("pessoas-fisicas.consultar", { cdPessoaFisica }),
    buscarPessoaFisicaPorCpf: (nrCpf: string) =>
      executeOperation<PessoaFisicaTasy>("pessoas-fisicas.buscar-cpf", { nrCpf }),
    salvarPessoaFisica: (input: SalvarPessoaFisicaTasy) =>
      executeOperation<{ cdPessoaFisica: string; acao: "inserido" | "alterado" }>(
        "pessoas-fisicas.salvar",
        input,
      ),
    // Only server-registered, authorized operations are accepted. No SQL endpoint.
    executeOperation,
  };
}
