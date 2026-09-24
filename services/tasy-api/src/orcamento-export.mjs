import { createHash } from "node:crypto";
import { ApiError } from "./errors.mjs";
import { tasySelection } from "./orcamento-schema.mjs";
import { catalogoOperations } from "./catalogos.mjs";

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

// Exports a quotation draft, not a priced/finalized quote. No calculation routines
// are called here: some of them COMMIT independently of the caller.
export function createBudgetExporter({ pool, enabled = false, audit = () => {} }) {
  return async (snapshot, principal) => {
    if (!enabled)
      throw new ApiError(
        403,
        "EXPORT_DISABLED",
        "Envio ao Tasy ainda não habilitado na homologação.",
      );
    if (
      !principal?.enabled ||
      !principal.operations.includes("orcamentos.enviar") ||
      !principal.tasyEstablishment ||
      !principal.tasyProfile
    )
      throw new ApiError(403, "FORBIDDEN", "Usuário sem permissão de envio ao Tasy.");
    const parsed = tasySelection.safeParse(snapshot.data.tasy);
    if (!parsed.success)
      throw new ApiError(
        400,
        "MISSING_TASY_SELECTION",
        "Crie um orçamento com paciente e itens selecionados no Tasy.",
      );
    const selection = parsed.data;
    if (!principal.allPessoaFisica && !principal.pessoaFisicaIds.includes(selection.cdPessoaFisica))
      throw new ApiError(403, "FORBIDDEN", "Paciente fora do escopo autorizado.");
    const hash = createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
    let c,
      committing = false;
    try {
      c = await pool.getConnection();
      c.callTimeout = 15000;
      c.clientId = principal.tasyUsername;
      c.module = "portal-tasy-api";
      c.action = "orcamentos.enviar";
      await c.execute(
        `BEGIN
        TASY.wheb_usuario_pck.set_nm_usuario(:usuario);
        TASY.wheb_usuario_pck.set_cd_estabelecimento(:estab);
        TASY.wheb_usuario_pck.set_cd_perfil(:perfil);
        TASY.wheb_usuario_pck.set_ie_executar_trigger('S');
      END;`,
        {
          usuario: principal.tasyUsername,
          estab: principal.tasyEstablishment,
          perfil: principal.tasyProfile,
        },
      );
      const ctx = (
        await c.execute(`SELECT TASY.wheb_usuario_pck.get_nm_usuario AS "usuario",
        TASY.wheb_usuario_pck.get_cd_estabelecimento AS "estab",
        TASY.wheb_usuario_pck.get_cd_perfil AS "perfil",
        TASY.wheb_usuario_pck.get_ie_executar_trigger AS "triggers" FROM dual`)
      ).rows?.[0];
      if (
        ctx?.usuario !== principal.tasyUsername ||
        Number(ctx.estab) !== principal.tasyEstablishment ||
        Number(ctx.perfil) !== principal.tasyProfile ||
        ctx.triggers !== "S"
      )
        throw new ApiError(503, "TASY_CONTEXT_MISMATCH", "Contexto Tasy não confirmado.");
      // Concurrent inserts wait on the PK: the losing transaction reads the committed result.
      try {
        await c.execute(
          `INSERT INTO TASY.PORTAL_ORCAMENTO_ENVIO
          (ID_PORTAL,HASH_CONTEUDO,ID_USUARIO_PORTAL,NM_USUARIO)
          VALUES (:id,:hash,:actor,:usuario)`,
          { id: snapshot.id, hash, actor: snapshot.actorId, usuario: principal.tasyUsername },
        );
      } catch (error) {
        if (error.errorNum !== 1) throw error;
        const previous = (
          await c.execute(
            `SELECT HASH_CONTEUDO AS "hash", TO_CHAR(NR_ORCAMENTO) AS "id"
          FROM TASY.PORTAL_ORCAMENTO_ENVIO WHERE ID_PORTAL=:id`,
            { id: snapshot.id },
          )
        ).rows?.[0];
        if (previous?.hash !== hash || !previous.id)
          throw new ApiError(409, "EXPORT_CONFLICT", "Envio anterior requer conferência no Tasy.");
        await c.rollback();
        return { nrOrcamento: previous.id, recuperado: true };
      }
      const patient = (
        await c.execute(
          `SELECT 1 AS "found" FROM TASY.pessoa_fisica
        WHERE cd_pessoa_fisica=:id AND nr_cpf=:cpf`,
          { id: selection.cdPessoaFisica, cpf: snapshot.data.paciente.cpf },
        )
      ).rows;
      if (patient?.length !== 1)
        throw new ApiError(409, "PATIENT_CHANGED", "Consulte novamente o paciente.");
      for (const item of selection.procedimentos) {
        const op = catalogoOperations["catalogos.procedimentos"];
        let matched = false;
        for (let offset = 0; offset <= 100000; offset += 100) {
          const page = await op.execute({
            connection: c,
            principal,
            input: {
              cdConvenio: selection.cdConvenio,
              cdCategoria: selection.cdCategoria,
              busca: item.codigo,
              offset,
            },
          });
          if (page.items.some((p) => p.codigo === item.codigo && p.origem === item.origem)) {
            matched = true;
            break;
          }
          if (!page.hasMore) break;
        }
        if (!matched)
          throw new ApiError(
            409,
            "CATALOG_CHANGED",
            "Procedimento sem vínculo ativo vigente. Revise o orçamento.",
          );
      }
      for (const item of selection.materiais) {
        let matched = false;
        for (const catalog of ["catalogos.opme", "catalogos.materiais"]) {
          for (let offset = 0; offset <= 100000; offset += 100) {
            const page = await catalogoOperations[catalog].execute({
              connection: c,
              input: { busca: item.codigo, offset },
            });
            if (page.items.some((m) => m.codigo === item.codigo)) {
              matched = true;
              break;
            }
            if (!page.hasMore) break;
          }
          if (matched) break;
        }
        if (!matched)
          throw new ApiError(
            409,
            "CATALOG_CHANGED",
            "Material OPME não está mais ativo no catálogo.",
          );
      }
      const next = async (name) =>
        (await c.execute(`SELECT TO_CHAR(TASY.${name}.NEXTVAL) AS "id" FROM dual`)).rows[0].id;
      const id = await next("ORCAMENTO_PACIENTE_SEQ");
      await c.execute(
        `INSERT INTO TASY.orcamento_paciente
        (nr_sequencia_orcamento,cd_estabelecimento,cd_pessoa_fisica,dt_orcamento,
         cd_convenio,cd_categoria,ie_status_orcamento,dt_atualizacao,nm_usuario,
         dt_atualizacao_nrec,nm_usuario_nrec,ds_observacao)
        VALUES (:id,:estab,:pessoa,SYSDATE,:convenio,:categoria,5,SYSDATE,:usuario,SYSDATE,:usuario,:obs)`,
        {
          id,
          estab: principal.tasyEstablishment,
          pessoa: selection.cdPessoaFisica,
          convenio: selection.cdConvenio,
          categoria: selection.cdCategoria,
          usuario: principal.tasyUsername,
          obs: `Portal ${snapshot.numero || snapshot.id}. Aguardando cotacao. Valores do portal nao constituem precificacao Tasy.`,
        },
      );
      let primary;
      for (const item of selection.procedimentos) {
        const itemId = await next("ORCAMENTO_PACIENTE_PROC_SEQ");
        await c.execute(
          `INSERT INTO TASY.orcamento_paciente_proc
          (nr_sequencia,nr_sequencia_orcamento,cd_procedimento,ie_origem_proced,qt_procedimento,
           dt_atualizacao,nm_usuario,nr_seq_proc_princ)
          VALUES (:itemId,:id,:codigo,:origem,:quantidade,SYSDATE,:usuario,:principal)`,
          {
            itemId,
            id,
            codigo: item.codigo,
            origem: item.origem,
            quantidade: item.quantidade,
            usuario: principal.tasyUsername,
            principal: primary ?? null,
          },
        );
        primary ??= itemId;
      }
      for (const item of selection.materiais) {
        const itemId = await next("ORCAMENTO_PACIENTE_MAT_SEQ");
        await c.execute(
          `INSERT INTO TASY.orcamento_paciente_mat
          (nr_sequencia,nr_sequencia_orcamento,cd_material,qt_material,dt_atualizacao,nm_usuario,nr_seq_proc_princ)
          VALUES (:itemId,:id,:codigo,:quantidade,SYSDATE,:usuario,:principal)`,
          {
            itemId,
            id,
            codigo: item.codigo,
            quantidade: item.quantidade,
            usuario: principal.tasyUsername,
            principal: primary,
          },
        );
      }
      const note =
        `Portal ${snapshot.id}; usuario portal ${snapshot.actorId}; aguardando cotacao. ` +
        `Valores informados no portal (nao precificados no ERP): medico=${snapshot.data.honorariosMedicos ?? "nao informado"}; hospital=${snapshot.data.valorHospitalar ?? "nao informado"}.`;
      await c.execute(
        `INSERT INTO TASY.orcamento_historico
        (nr_sequencia,nr_sequencia_orcamento,dt_atualizacao,nm_usuario,dt_atualizacao_nrec,nm_usuario_nrec,dt_historico,ds_historico,dt_liberacao)
        VALUES (TASY.ORCAMENTO_HISTORICO_SEQ.NEXTVAL,:id,SYSDATE,:usuario,SYSDATE,:usuario,SYSDATE,:nota,SYSDATE)`,
        { id, usuario: principal.tasyUsername, nota: note },
      );
      await c.execute(
        "UPDATE TASY.PORTAL_ORCAMENTO_ENVIO SET NR_ORCAMENTO=:orc WHERE ID_PORTAL=:id",
        { orc: id, id: snapshot.id },
      );
      committing = true;
      await c.commit();
      return { nrOrcamento: id, recuperado: false };
    } catch (error) {
      if (c) await c.rollback().catch(() => {});
      audit({
        operation: "orcamentos.enviar",
        outcome: committing ? "unknown" : "failed",
        code: error.code,
        oracleError: error.errorNum,
      });
      if (error instanceof ApiError && !committing) throw error;
      throw new ApiError(
        503,
        committing ? "WRITE_OUTCOME_UNKNOWN" : "TASY_EXPORT_FAILED",
        committing
          ? "Sem confirmação do envio. Reconcilie a mesma solicitação antes de qualquer novo envio."
          : "Não foi possível enviar ao Tasy. Confira a configuração e os registros da integração.",
      );
    } finally {
      if (c) await c.close({ drop: true }).catch(() => {});
    }
  };
}
