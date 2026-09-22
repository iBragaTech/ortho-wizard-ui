import { z } from "zod";
import { ApiError } from "./errors.mjs";
import { catalogoOperations } from "./catalogos.mjs";

export const precoOperations = {
  "precos.procedimento": {
    kind: "read",
    discardConnection: true,
    schema: z
      .object({
        cdConvenio: z.string().regex(/^\d{1,15}$/),
        cdCategoria: z.string().min(1).max(10),
        codigo: z.string().regex(/^\d{1,15}$/),
        origem: z.string().regex(/^\d{1,15}$/),
      })
      .strict(),
    authorize: ({ principal }) =>
      principal.enabled === true && !!principal.tasyEstablishment && !!principal.tasyProfile,
    execute: async ({ connection, input, principal }) => {
      let valid = false;
      let nome;
      for (let offset = 0; offset <= 100000; offset += 100) {
        const page = await catalogoOperations["catalogos.procedimentos"].execute({
          connection,
          principal,
          input: {
            cdConvenio: input.cdConvenio,
            cdCategoria: input.cdCategoria,
            busca: input.codigo,
            offset,
          },
        });
        if (page.items.some((p) => p.codigo === input.codigo && p.origem === input.origem)) {
          nome = page.items.find(
            (p) => p.codigo === input.codigo && p.origem === input.origem,
          )?.nome;
          valid = true;
          break;
        }
        if (!page.hasMore) break;
      }
      if (!valid)
        throw new ApiError(
          409,
          "CATALOG_CHANGED",
          "Procedimento, convênio ou categoria indisponível no cadastro ativo do Tasy.",
        );
      await priceContext(connection, principal);
      // Native function chooses procedure/service calculation. No W_CONSULTA_PRECO
      // deletion and no call to GERAR_CONSULTA_PRECO. Executor enforces READ ONLY.
      const fn = (option) => `TASY.obter_preco_procedimento(:estab,:convenio,:categoria,SYSDATE,
        :codigo,:origem,0,0,0,NULL,NULL,NULL,NULL,0,0,'${option}')`;
      const result = await connection.execute(
        `SELECT ${fn("P")} AS "valorProcedimento",
        ${fn("H")} AS "honorarios", ${fn("C")} AS "custoOperacional", ${fn("F")} AS "filmeMateriais",
        p.ie_classificacao AS "classificacao",
        TO_CHAR(SYSDATE,'YYYY-MM-DD"T"HH24:MI:SS') AS "consultadoEm"
        FROM TASY.procedimento p WHERE p.cd_procedimento=:codigo AND p.ie_origem_proced=:origem`,
        {
          estab: principal.tasyEstablishment,
          convenio: input.cdConvenio,
          categoria: input.cdCategoria,
          codigo: input.codigo,
          origem: input.origem,
        },
        { maxRows: 1 },
      );
      const row = result.rows?.[0];
      if (!row)
        throw new ApiError(503, "PRICE_UNAVAILABLE", "O Tasy não retornou a referência de preço.");
      return {
        ...row,
        nome,
        // Native service branch returns only P; medical components are not calculated.
        ...(row.classificacao != null && String(row.classificacao) !== "1"
          ? { honorariosNativo: row.honorarios, honorarios: 0, tipoCalculo: "servico" }
          : { tipoCalculo: "procedimento" }),
        ...input,
        estabelecimento: principal.tasyEstablishment,
        contexto:
          "Referência unitária do item selecionado, sem médico, plano, acomodação ou tipo de atendimento específico. Não inclui outros itens ou negociações.",
      };
    },
  },
};

async function priceContext(connection, principal) {
  await connection.execute(
    `BEGIN
        TASY.wheb_usuario_pck.set_nm_usuario(:usuario);
        TASY.wheb_usuario_pck.set_cd_estabelecimento(:estab);
        TASY.wheb_usuario_pck.set_cd_perfil(:perfil);
      END;`,
    {
      usuario: principal.tasyUsername,
      estab: principal.tasyEstablishment,
      perfil: principal.tasyProfile,
    },
  );
  const context = (
    await connection.execute(`SELECT TASY.wheb_usuario_pck.get_nm_usuario AS "usuario",
        TASY.wheb_usuario_pck.get_cd_estabelecimento AS "estab", TASY.wheb_usuario_pck.get_cd_perfil AS "perfil" FROM dual`)
  ).rows?.[0];
  if (
    context?.usuario !== principal.tasyUsername ||
    Number(context?.estab) !== principal.tasyEstablishment ||
    Number(context?.perfil) !== principal.tasyProfile
  )
    throw new ApiError(
      503,
      "TASY_CONTEXT_MISMATCH",
      "Contexto do cálculo não confirmado pelo Tasy.",
    );
}

precoOperations["precos.material"] = {
  kind: "read",
  discardConnection: true,
  schema: z
    .object({
      cdConvenio: z.string().regex(/^\d{1,15}$/),
      cdCategoria: z.string().min(1).max(10),
      codigo: z.string().regex(/^\d{1,15}$/),
    })
    .strict(),
  authorize: precoOperations["precos.procedimento"].authorize,
  execute: async ({ connection, input, principal }) => {
    const valid = await connection.execute(
      `SELECT a.cd_material, a.ds_material AS "nome" FROM TASY.material a
      JOIN TASY.classe_material b ON b.cd_classe_material=a.cd_classe_material
      JOIN TASY.subgrupo_material c ON c.cd_subgrupo_material=b.cd_subgrupo_material
      JOIN TASY.grupo_material d ON d.cd_grupo_material=c.cd_grupo_material
      JOIN TASY.categoria_convenio cat ON cat.cd_convenio=:convenio AND cat.cd_categoria=:categoria
      JOIN TASY.convenio conv ON conv.cd_convenio=cat.cd_convenio
      WHERE a.cd_material=:codigo AND a.ie_situacao='A' AND b.ie_situacao='A'
      AND c.ie_situacao='A' AND d.ie_situacao='A' AND cat.ie_situacao='A' AND conv.ie_situacao='A'`,
      { convenio: input.cdConvenio, categoria: input.cdCategoria, codigo: input.codigo },
      { maxRows: 1 },
    );
    if (!valid.rows?.length)
      throw new ApiError(409, "CATALOG_CHANGED", "Material, convênio ou categoria inativo.");
    await priceContext(connection, principal);
    const result = await connection.execute(
      `SELECT TASY.obter_preco_material(:estab,:convenio,:categoria,SYSDATE,:codigo,0,0,0,NULL,0,0) AS "valorMaterial",
      TO_CHAR(SYSDATE,'YYYY-MM-DD"T"HH24:MI:SS') AS "consultadoEm" FROM dual`,
      {
        estab: principal.tasyEstablishment,
        convenio: input.cdConvenio,
        categoria: input.cdCategoria,
        codigo: input.codigo,
      },
      { maxRows: 1 },
    );
    if (!result.rows?.length)
      throw new ApiError(503, "PRICE_UNAVAILABLE", "Preço de material indisponível.");
    return {
      ...result.rows[0],
      ...input,
      nome: valid.rows[0].nome,
      estabelecimento: principal.tasyEstablishment,
    };
  },
};
