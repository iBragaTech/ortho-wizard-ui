import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { ApiError } from "../errors.mjs";
const scrypt = promisify(scryptCallback);
const digest = (token) => createHash("sha256").update(token).digest("hex");
export const passwordSchema = z.string().min(12).max(128);
export const userSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    perfil: z.enum(["Administrador", "Comercial", "Médico"]),
    senha: passwordSchema,
  })
  .strict();
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "Dados inválidos. Senhas novas devem ter de 12 a 128 caracteres.",
    );
  return result.data;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
async function verify(password, encoded) {
  const [, salt, hex] = encoded.split(":");
  const key = await scrypt(password, salt, 64);
  const stored = Buffer.from(hex, "hex");
  return key.length === stored.length && timingSafeEqual(key, stored);
}
export function publicUser(user) {
  return { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil };
}
export async function createUser(db, input) {
  const user = parse(userSchema, input);
  const hashed = await hashPassword(user.senha);
  const result = await db.query(
    `INSERT INTO portal.users(nome,email,perfil,password_hash)
    VALUES ($1,$2,$3,$4) RETURNING id,nome,email,perfil`,
    [user.nome, user.email, user.perfil, hashed],
  );
  return result.rows[0];
}
export async function createLocalAuth(db) {
  const dummyHash = await hashPassword(randomBytes(24).toString("hex"));
  const loginSchema = z
    .object({ email: z.string().trim().email().max(254), senha: z.string().min(1).max(128) })
    .strict();
  return {
    login: async (body) => {
      const { email, senha } = parse(loginSchema, body);
      const { rows } = await db.query("SELECT * FROM portal.users WHERE email = $1", [
        email.toLowerCase(),
      ]);
      const user = rows[0];
      const valid = await verify(senha, user?.password_hash || dummyHash);
      if (!user?.ativo || !valid)
        throw new ApiError(401, "UNAUTHORIZED", "E-mail ou senha inválidos.");
      const token = randomBytes(32).toString("base64url");
      await db.transaction(async (tx) => {
        await tx.query("DELETE FROM portal.sessions WHERE expires_at <= now()");
        await tx.query(
          "INSERT INTO portal.sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now() + interval '8 hours')",
          [digest(token), user.id],
        );
        await tx.query("UPDATE portal.users SET ultimo_acesso = now() WHERE id = $1", [user.id]);
      });
      return { token, user: publicUser(user) };
    },
    authenticate: async (header) => {
      if (typeof header !== "string" || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) {
        throw new ApiError(401, "UNAUTHORIZED", "Autenticação necessária.");
      }
      const tokenHash = digest(header.slice(7));
      const { rows } = await db.query(
        `SELECT u.id,u.nome,u.email,u.perfil FROM portal.sessions s
        JOIN portal.users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.ativo = true`,
        [tokenHash],
      );
      if (!rows.length) throw new ApiError(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
      return { ...publicUser(rows[0]), tokenHash };
    },
    logout: (user) =>
      db.query("DELETE FROM portal.sessions WHERE token_hash = $1", [user.tokenHash]),
  };
}
