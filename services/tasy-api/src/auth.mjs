import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "./errors.mjs";

export function createAuthenticator(config, principals, keySet) {
  const keys =
    keySet ??
    createRemoteJWKSet(new URL(config.AUTH_JWKS_URL), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
    });
  return async (authorization) => {
    if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) {
      throw new ApiError(401, "UNAUTHORIZED", "Autenticação necessária.");
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(authorization.slice(7), keys, {
        issuer: config.AUTH_ISSUER,
        audience: config.AUTH_AUDIENCE,
        algorithms: [config.AUTH_ALGORITHM],
        requiredClaims: ["sub", "exp", "iat"],
        clockTolerance: 5,
      }));
    } catch {
      throw new ApiError(401, "UNAUTHORIZED", "Token inválido ou expirado.");
    }
    const entry = Object.hasOwn(principals, payload.sub) ? principals[payload.sub] : undefined;
    if (!entry?.enabled) throw new ApiError(403, "FORBIDDEN", "Usuário sem acesso à integração.");
    // Roles and the Tasy username come from server-owned configuration, never the body.
    return { subject: payload.sub, ...entry };
  };
}
