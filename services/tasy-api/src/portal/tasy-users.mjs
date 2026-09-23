import { z } from "zod";
import { ApiError } from "../errors.mjs";

export const linkFields = {
  nmUsuario: z.string().trim().min(1).max(15),
  cdPerfil: z.number().int().positive().max(2147483647),
  cdEstabelecimento: z.number().int().positive().max(2147483647),
  consultarTodosPacientes: z.boolean().default(false),
  cadastrarPacientes: z.boolean().default(false),
};

export function principalForLink(link) {
  return {
    enabled: true,
    tasyUsername: link.nmUsuario,
    tasyProfile: link.cdPerfil,
    tasyEstablishment: link.cdEstabelecimento,
    operations: [
      "usuarios.consultar",
      "pessoas-fisicas.consultar",
      "pessoas-fisicas.buscar-cpf",
      "catalogos.convenios",
      "catalogos.categorias",
      "catalogos.procedimentos",
      "catalogos.opme",
      "catalogos.materiais",
      "precos.procedimento",
      "precos.material",
      ...(link.cadastrarPacientes ? ["pessoas-fisicas.salvar"] : []),
    ],
    allPessoaFisica: link.consultarTodosPacientes,
    pessoaFisicaIds: [],
    canCreatePessoaFisica: link.cadastrarPacientes,
    canUpdatePessoaFisica: false,
  };
}

export async function storeLink(tx, userId, principal, actorId) {
  const old =
    (
      await tx.query("SELECT principal FROM portal.tasy_user_links WHERE user_id=$1 FOR UPDATE", [
        userId,
      ])
    ).rows[0]?.principal ?? null;
  await tx.query(
    `INSERT INTO portal.tasy_user_links(user_id,nm_usuario,principal) VALUES($1,$2,$3::jsonb)
    ON CONFLICT(user_id) DO UPDATE SET nm_usuario=excluded.nm_usuario,principal=excluded.principal,updated_at=now()`,
    [userId, principal.tasyUsername, JSON.stringify(principal)],
  );
  await tx.query(
    "INSERT INTO portal.tasy_user_link_events(user_id,actor_id,anterior,novo) VALUES($1,$2,$3::jsonb,$4::jsonb)",
    [userId, actorId, old ? JSON.stringify(old) : null, JSON.stringify(principal)],
  );
}

export async function importLegacyLinks(db, principals) {
  await db.transaction(async (tx) => {
    for (const [id, principal] of Object.entries(principals)) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      if (!(await tx.query("SELECT id FROM portal.users WHERE id=$1", [id])).rows.length) continue;
      if (
        (await tx.query("SELECT user_id FROM portal.tasy_user_links WHERE user_id=$1", [id])).rows
          .length
      )
        continue;
      await storeLink(tx, id, principal, null);
    }
  });
}

export function createLinkResolver(db, validate) {
  return async (user, queryDb = db) => {
    const row = (
      await queryDb.query("SELECT principal FROM portal.tasy_user_links WHERE user_id=$1", [
        user.id,
      ])
    ).rows[0];
    if (!row?.principal?.enabled)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Usuário sem vínculo Tasy ativo. Solicite ao administrador a configuração do acesso.",
      );
    const p = row.principal;
    if (validate)
      await validate({
        nmUsuario: p.tasyUsername,
        cdPerfil: p.tasyProfile,
        cdEstabelecimento: p.tasyEstablishment,
      });
    return { ...p, subject: user.id };
  };
}

// Reads only identity and membership. Never reads passwords or hashes from Tasy.
export function createTasyLinkValidator(pool) {
  return async (link) => {
    if (!pool)
      throw new ApiError(
        503,
        "TASY_DISABLED",
        "Conecte a API ao Tasy para validar o usuário e o perfil.",
      );
    let c;
    try {
      c = await pool.getConnection();
      c.callTimeout = 10000;
      await c.execute("SET TRANSACTION READ ONLY");
      const result = await c.execute(
        `SELECT u.nm_usuario AS "nmUsuario" FROM TASY.usuario u
        JOIN TASY.usuario_perfil up ON up.nm_usuario=u.nm_usuario
        JOIN TASY.perfil p ON p.cd_perfil=up.cd_perfil
        WHERE LOWER(u.nm_usuario)=LOWER(:usuario) AND u.ie_situacao='A' AND p.ie_situacao='A'
        AND up.cd_perfil=:perfil AND (up.dt_validade IS NULL OR up.dt_validade>=SYSDATE)
        AND (up.dt_liberacao IS NULL OR up.dt_liberacao<=SYSDATE)
        AND (p.cd_estabelecimento IS NULL OR p.cd_estabelecimento=:estab)
        AND (u.cd_estabelecimento=:estab OR EXISTS(SELECT 1 FROM TASY.usuario_estabelecimento e
          WHERE e.nm_usuario_param=u.nm_usuario AND e.cd_estabelecimento=:estab))`,
        { usuario: link.nmUsuario, perfil: link.cdPerfil, estab: link.cdEstabelecimento },
        { maxRows: 2 },
      );
      if (result.rows?.length !== 1)
        throw new ApiError(
          403,
          "INVALID_TASY_LINK",
          "Usuário inativo, perfil não autorizado/vencido ou estabelecimento sem acesso no Tasy.",
        );
      return { ...link, nmUsuario: result.rows[0].nmUsuario };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(503, "TASY_UNAVAILABLE", "Não foi possível validar o vínculo no Tasy.");
    } finally {
      if (c) {
        await c.rollback().catch(() => {});
        await c.close({ drop: true }).catch(() => {});
      }
    }
  };
}
