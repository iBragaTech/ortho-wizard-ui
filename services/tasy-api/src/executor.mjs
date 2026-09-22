import { ApiError } from "./errors.mjs";

export function createExecutor({ pool, operations, writesEnabled, callTimeout, audit }) {
  return async ({ name, body, principal, requestId }) => {
    const operation = Object.hasOwn(operations, name) ? operations[name] : undefined;
    if (!operation) throw new ApiError(404, "UNKNOWN_OPERATION", "Operação não disponível.");
    if (!principal.operations.includes(name)) {
      throw new ApiError(403, "FORBIDDEN", "Operação não autorizada.");
    }
    if (operation.kind === "write" && !writesEnabled) {
      throw new ApiError(403, "WRITES_DISABLED", "Gravações desabilitadas neste ambiente.");
    }
    const parsed = operation.schema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Parâmetros inválidos.");
    const context = { input: parsed.data, principal, requestId };
    let connection;
    let committed = false;
    let commitStarted = false;
    // Tasy triggers can change additional PL/SQL package globals. Discard write
    // sessions rather than assuming that resetting four known fields is enough.
    let dropConnection = operation.kind === "write" || operation.discardConnection === true;
    try {
      connection = await pool.getConnection();
      connection.callTimeout = callTimeout;
      connection.clientId = principal.tasyUsername;
      connection.module = "portal-tasy-api";
      connection.action = name.slice(0, 32);
      // For writes this callback MUST enforce record/establishment access using
      // this same connection; the database routine must also guard concurrent edits.
      if (operation.kind === "read") {
        await connection.execute("SET TRANSACTION READ ONLY");
      }
      if ((await operation.authorize({ ...context, connection })) !== true) {
        throw new ApiError(403, "FORBIDDEN", "Acesso ao registro não autorizado.");
      }
      const result = await operation.execute({ ...context, connection });
      // Verify serialization before committing: no LOB handles or unserializable results.
      const data = JSON.parse(JSON.stringify(result));
      if (operation.kind === "write") {
        commitStarted = true;
        await connection.commit();
        committed = true;
      } else {
        await connection.rollback();
      }
      audit({ requestId, subject: principal.subject, operation: name, outcome: "success" });
      return data;
    } catch (error) {
      if (connection && !committed) {
        try {
          await connection.rollback();
        } catch {
          dropConnection = true;
        }
      }
      const outcome = commitStarted ? "unknown" : "failed";
      audit({ requestId, subject: principal.subject, operation: name, outcome });
      if (error instanceof ApiError && !commitStarted) throw error;
      // A lost commit response can mean that Oracle already committed. Never retry writes automatically.
      throw new ApiError(
        503,
        commitStarted ? "WRITE_OUTCOME_UNKNOWN" : "TASY_UNAVAILABLE",
        commitStarted
          ? "Confirme o resultado no Tasy antes de repetir a operação."
          : "Não foi possível concluir a operação no Tasy.",
      );
    } finally {
      if (connection) {
        try {
          if (dropConnection) await connection.close({ drop: true });
          else await connection.close();
        } catch {
          audit({ requestId, operation: name, outcome: "connection_close_failed" });
        }
      }
    }
  };
}
