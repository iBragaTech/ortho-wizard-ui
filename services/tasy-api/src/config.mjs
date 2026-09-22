import { readFile } from "node:fs/promises";
import { z } from "zod";

const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:");
const environment = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  PORTAL_ORIGIN: httpsUrl.refine((value) => new URL(value).origin === value),
  AUTH_ISSUER: httpsUrl,
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_JWKS_URL: httpsUrl,
  AUTH_ALGORITHM: z.enum(["RS256", "ES256"]).default("RS256"),
  TASY_PRINCIPALS_FILE: z.string().min(1),
  ORACLE_USER: z.string().min(1),
  ORACLE_PASSWORD: z.string().min(1),
  ORACLE_CONNECT_STRING: z.string().min(1),
  ORACLE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(4),
  ORACLE_CALL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  ORACLE_CLIENT_LIB_DIR: z.string().optional(),
  TASY_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
  TASY_PESSOA_FISICA_DML_ENABLED: z.enum(["true", "false"]).default("false"),
  TASY_OPERATIONS_FILE: z.string().optional(),
});

export function readConfig(env) {
  const parsed = environment.safeParse(env);
  if (!parsed.success) {
    // Never print values, particularly credentials or connection strings.
    throw new Error(
      `Configuração inválida: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}

export async function readPrincipals(path) {
  const schema = z.record(
    z
      .object({
        enabled: z.boolean(),
        tasyUsername: z.string().min(1).max(15),
        tasyEstablishment: z.number().int().positive().optional(),
        tasyProfile: z.number().int().positive().optional(),
        operations: z.array(z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/)),
        pessoaFisicaIds: z.array(z.string().regex(/^[0-9]{1,10}$/)).default([]),
        canCreatePessoaFisica: z.boolean().default(false),
        canUpdatePessoaFisica: z.boolean().default(true),
        allPessoaFisica: z.boolean().default(false),
      })
      .strict(),
  );
  const parsed = schema.safeParse(JSON.parse(await readFile(path, "utf8")));
  if (!parsed.success) throw new Error("Cadastro local de permissões inválido.");
  return parsed.data;
}
