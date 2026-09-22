import { z } from "zod";
import { ApiError } from "./errors.mjs";

// The only known mapping supplied for this installation. Validate in homologation.
// Reads only the authenticated principal's mapped username, not other users.
export const operations = {
  "usuarios.consultar": {
    kind: "read",
    schema: z.object({ nmUsuario: z.string().trim().min(1).max(128) }).strict(),
    authorize: ({ input, principal }) => input.nmUsuario === principal.tasyUsername,
    execute: async ({ connection, input }) => {
      const result = await connection.execute(
        'SELECT nm_usuario AS "nmUsuario" FROM usuario WHERE nm_usuario = :nmUsuario AND ROWNUM <= 1',
        { nmUsuario: input.nmUsuario },
        { maxRows: 1 },
      );
      if (!result.rows?.length) throw new ApiError(404, "NOT_FOUND", "Usuário não encontrado.");
      return result.rows[0];
    },
  },
};

export function validateOperations(registry) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new Error("Registro de operações inválido.");
  }
  for (const [name, operation] of Object.entries(registry)) {
    if (
      !/^[a-z][a-z0-9.-]{0,79}$/.test(name) ||
      !["read", "write"].includes(operation?.kind) ||
      typeof operation.schema?.safeParse !== "function" ||
      typeof operation.authorize !== "function" ||
      typeof operation.execute !== "function"
    ) {
      throw new Error("Toda operação exige nome, tipo, schema, autorização e execução.");
    }
  }
  return registry;
}
