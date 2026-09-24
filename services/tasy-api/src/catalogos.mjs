import { z } from "zod";

const pagination = { offset: z.number().int().min(0).max(100000).default(0) };
const active = ({ principal }) => principal.enabled === true;
const page = async (connection, sql, binds) => {
  const result = await connection.execute(sql, binds, { maxRows: 101 });
  return { items: result.rows.slice(0, 100), hasMore: result.rows.length > 100 };
};
export const catalogoOperations = {
  "catalogos.procedimentos": {
    kind: "read",
    authorize: ({ principal }) =>
      principal.enabled === true &&
      Number.isInteger(principal.tasyEstablishment) &&
      principal.tasyEstablishment > 0,
    schema: z
      .object({
        ...pagination,
        busca: z.string().trim().max(80).default(""),
        cdConvenio: z.string().regex(/^\d{1,15}$/),
        cdCategoria: z.string().min(1).max(10),
      })
      .strict(),
    execute: ({ connection, input }) =>
      page(
        connection,
        `SELECT TRIM(TO_CHAR(p.cd_procedimento)) AS "codigo",
          TRIM(TO_CHAR(p.ie_origem_proced)) AS "origem", TRIM(p.ds_procedimento) AS "nome"
        FROM TASY.procedimento p
        JOIN TASY.convenio v ON v.cd_convenio = :cdConvenio AND v.ie_situacao = 'A'
        JOIN TASY.categoria_convenio c ON c.cd_convenio = v.cd_convenio
          AND c.cd_categoria = :cdCategoria AND c.ie_situacao = 'A'
        WHERE p.ie_situacao = 'A' AND p.ds_procedimento IS NOT NULL
          AND (:busca IS NULL OR INSTR(UPPER(p.ds_procedimento), UPPER(:busca)) > 0
            OR TRIM(TO_CHAR(p.cd_procedimento)) LIKE TRIM(:busca) || '%')
        ORDER BY p.ds_procedimento, p.cd_procedimento, p.ie_origem_proced
        OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY`,
        input,
      ),
  },
  "catalogos.opme": {
    kind: "read",
    authorize: active,
    schema: z.object({ ...pagination, busca: z.string().trim().max(80).default("") }).strict(),
    execute: ({ connection, input }) =>
      page(
        connection,
        `SELECT
      TO_CHAR(a.cd_material) AS "codigo", a.ds_material AS "nome",
      d.ds_grupo_material AS "grupo"
      FROM TASY.material a
      JOIN TASY.classe_material b ON b.cd_classe_material = a.cd_classe_material
      JOIN TASY.subgrupo_material c ON c.cd_subgrupo_material = b.cd_subgrupo_material
      JOIN TASY.grupo_material d ON d.cd_grupo_material = c.cd_grupo_material
      WHERE a.ie_situacao = 'A' AND b.ie_situacao = 'A'
        AND c.ie_situacao = 'A' AND d.ie_situacao = 'A'
        AND d.cd_grupo_material IN (59, 60, 61,13) AND a.ds_material IS NOT NULL
        AND (:busca IS NULL OR INSTR(UPPER(a.ds_material), UPPER(:busca)) > 0
          OR TRIM(TO_CHAR(a.cd_material)) LIKE TRIM(:busca) || '%')
      ORDER BY a.ds_material, a.cd_material OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY`,
        input,
      ),
  },
  "catalogos.materiais": {
    kind: "read",
    authorize: active,
    schema: z.object({ ...pagination, busca: z.string().trim().max(80).default("") }).strict(),
    execute: ({ connection, input }) =>
      page(
        connection,
        `SELECT TO_CHAR(a.cd_material) AS "codigo", a.ds_material AS "nome",
          d.ds_grupo_material AS "grupo"
        FROM TASY.material a
        JOIN TASY.classe_material b ON b.cd_classe_material = a.cd_classe_material
        JOIN TASY.subgrupo_material c ON c.cd_subgrupo_material = b.cd_subgrupo_material
        JOIN TASY.grupo_material d ON d.cd_grupo_material = c.cd_grupo_material
        WHERE a.ie_situacao = 'A' AND b.ie_situacao = 'A'
          AND c.ie_situacao = 'A' AND d.ie_situacao = 'A'
          AND d.cd_grupo_material IN (1,4) AND a.ds_material IS NOT NULL
          AND (:busca IS NULL OR INSTR(UPPER(a.ds_material), UPPER(:busca)) > 0
            OR TRIM(TO_CHAR(a.cd_material)) LIKE TRIM(:busca) || '%')
        ORDER BY a.ds_material, a.cd_material OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY`,
        input,
      ),
  },
  "catalogos.convenios": {
    kind: "read",
    authorize: active,
    schema: z.object({ ...pagination, busca: z.string().trim().max(80).default("") }).strict(),
    execute: ({ connection, input }) =>
      page(
        connection,
        `SELECT
      TO_CHAR(cd_convenio) AS "codigo", ds_convenio AS "nome"
      FROM TASY.convenio WHERE ie_situacao = 'A' AND ds_convenio IS NOT NULL
      AND (:busca IS NULL OR INSTR(UPPER(ds_convenio), UPPER(:busca)) > 0 OR TO_CHAR(cd_convenio) = :busca)
      ORDER BY ds_convenio, cd_convenio OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY`,
        input,
      ),
  },
  "catalogos.categorias": {
    kind: "read",
    authorize: active,
    schema: z.object({ ...pagination, cdConvenio: z.string().regex(/^\d{1,15}$/) }).strict(),
    execute: ({ connection, input }) =>
      page(
        connection,
        `SELECT
      c.cd_categoria AS "codigo", c.ds_categoria AS "nome"
      FROM TASY.categoria_convenio c JOIN TASY.convenio v ON v.cd_convenio = c.cd_convenio
      WHERE c.cd_convenio = :cdConvenio AND c.ie_situacao = 'A' AND v.ie_situacao = 'A'
      AND c.ds_categoria IS NOT NULL
      AND c.cd_categoria IN (1,4)
      ORDER BY c.ds_categoria, c.cd_categoria OFFSET :offset ROWS FETCH NEXT 101 ROWS ONLY`,
        input,
      ),
  },
};
