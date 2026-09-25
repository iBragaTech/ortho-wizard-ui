import { ApiError } from "./errors.mjs";

// Reads the saved quote, never recalculates prices or modifies ERP data.
export function createBudgetReader({ pool }) {
  return async ({ id, tasyId, patientId, establishment }) => {
    let c;
    try {
      c = await pool.getConnection();
      c.callTimeout = 10000;
      await c.execute("SET TRANSACTION READ ONLY");
      const header = await c.execute(
        `SELECT TO_CHAR(o.nr_sequencia_orcamento) AS "id",
          o.ie_status_orcamento AS "statusCode",
          TASY.obter_valor_dominio(31,o.ie_status_orcamento) AS "statusLabel",
          TASY.obter_valor_orc_pac(o.nr_sequencia_orcamento) AS "total",
          TO_CHAR(o.dt_aprovacao,'YYYY-MM-DD"T"HH24:MI:SS') AS "approvedAt",
          TO_CHAR(o.dt_validade,'YYYY-MM-DD') AS "validUntil"
         FROM TASY.AEBMG_PORTAL_ORCAMENTO_ENVIO e
         JOIN TASY.orcamento_paciente o ON o.nr_sequencia_orcamento=e.nr_orcamento
         WHERE e.id_portal=:id AND e.nr_orcamento=:tasyId
           AND o.cd_pessoa_fisica=:patientId AND o.cd_estabelecimento=:establishment`,
        { id, tasyId, patientId, establishment },
        { maxRows: 2 },
      );
      if (header.rows?.length !== 1)
        throw new ApiError(409, "TASY_LINK_CHANGED", "Vínculo do orçamento Tasy não confirmado.");
      const procedures = await c.execute(
        `SELECT TO_CHAR(p.nr_sequencia) AS "id", TO_CHAR(p.cd_procedimento) AS "codigo",
          TO_CHAR(p.ie_origem_proced) AS "origem", p.qt_procedimento AS "quantidade",
          p.vl_procedimento AS "total", NVL(p.vl_medico,0) AS "medico",
          NVL(p.vl_anestesista,0) AS "anestesista", NVL(p.vl_desconto,0) AS "desconto",
          TASY.obter_desc_procedimento(p.cd_procedimento,p.ie_origem_proced) AS "descricao",
          CASE WHEN NVL(p.ie_agendavel,'N')='N' OR
            (p.ie_agendavel='S' AND p.ie_pacote='S' AND EXISTS
              (SELECT 1 FROM TASY.orcamento_pac_proc_valor v WHERE v.nr_seq_orc_proced=p.nr_sequencia))
            THEN 1 ELSE 0 END AS "contabilizado"
         FROM TASY.orcamento_paciente_proc p WHERE p.nr_sequencia_orcamento=:tasyId
         ORDER BY p.nr_sequencia`,
        { tasyId },
        { maxRows: 10001 },
      );
      const materials = await c.execute(
        `SELECT TO_CHAR(m.nr_sequencia) AS "id", TO_CHAR(m.cd_material) AS "codigo",
          m.qt_material AS "quantidade", m.vl_material AS "total",
          NVL(m.vl_desconto,0) AS "desconto", TASY.obter_desc_material(m.cd_material) AS "descricao"
         FROM TASY.orcamento_paciente_mat m WHERE m.nr_sequencia_orcamento=:tasyId
         ORDER BY m.nr_sequencia`,
        { tasyId },
        { maxRows: 10001 },
      );
      const docs = await c.execute(
        `SELECT COUNT(*) AS "count",
          TO_CHAR(MIN(NVL(dt_atualizacao_nrec,dt_atualizacao)),'YYYY-MM-DD"T"HH24:MI:SS') AS "receiptAt"
         FROM TASY.orcamento_pac_doc
         WHERE nr_orc_pac=:tasyId AND nr_seq_tipo_doc=1`,
        { tasyId },
      );
      if (procedures.rows.length > 10000 || materials.rows.length > 10000)
        throw new ApiError(
          409,
          "TASY_TOO_MANY_ITEMS",
          "Orçamento excede o limite de itens da consulta.",
        );
      return {
        ...header.rows[0],
        receipt: docs.rows[0].count > 0,
        receiptAt: docs.rows[0].receiptAt ?? null,
        itens: [
          ...procedures.rows.map((r) => ({ ...r, tipo: "procedimento" })),
          ...materials.rows.map((r) => ({
            ...r,
            tipo: "material",
            contabilizado: 1,
            medico: 0,
            anestesista: 0,
          })),
        ],
      };
    } finally {
      if (c) {
        await c.rollback().catch(() => {});
        await c.close();
      }
    }
  };
}
