import { z } from "zod";
import { parse } from "./auth.mjs";
import { ApiError } from "../errors.mjs";

const code = z.string().trim().min(1).max(40);
const item = {
  codigo: code,
  nome: z.string().trim().min(1).max(1000),
  quantidade: z.number().int().min(1).max(10000),
};
const procedure = z.object({ ...item, origem: code }).strict();
const material = z.object({ ...item, grupo: z.string().max(200).nullable() }).strict();
const template = z
  .object({
    nome: z.string().trim().min(1).max(120),
    dados: z
      .object({
        cdConvenio: code,
        cdCategoria: code,
        procedimento: z.array(procedure).length(1),
        adicionais: z.array(procedure).max(100),
        materiais: z.array(material).max(200),
        opme: z.array(material).max(200),
      })
      .strict(),
  })
  .strict();

export function budgetTemplateOperations(db) {
  const requireDoctor = (user) => {
    if (user.perfil !== "Médico")
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Modelos pessoais estão disponíveis somente para médicos.",
      );
  };
  return {
    listBudgetTemplates: async (input, user) => {
      requireDoctor(user);
      parse(z.object({}).strict(), input);
      return (
        await db.query(
          "SELECT id,nome,dados FROM portal.budget_templates WHERE user_id=$1 ORDER BY lower(nome),id",
          [user.id],
        )
      ).rows;
    },
    saveBudgetTemplate: async (input, user) => {
      requireDoctor(user);
      const value = parse(template, input);
      try {
        return (
          await db.query(
            "INSERT INTO portal.budget_templates(user_id,nome,dados) VALUES($1,$2,$3::jsonb) RETURNING id,nome,dados",
            [user.id, value.nome, JSON.stringify(value.dados)],
          )
        ).rows[0];
      } catch (error) {
        if (error.code === "23505")
          throw new ApiError(
            409,
            "ALREADY_EXISTS",
            "Você já possui um modelo com esse nome. Escolha outro nome.",
          );
        throw error;
      }
    },
    deleteBudgetTemplate: async (input, user) => {
      requireDoctor(user);
      const value = parse(z.object({ id: z.string().uuid() }).strict(), input);
      const result = await db.query(
        "DELETE FROM portal.budget_templates WHERE id=$1 AND user_id=$2 RETURNING id",
        [value.id, user.id],
      );
      if (!result.rows.length) throw new ApiError(404, "NOT_FOUND", "Modelo não encontrado.");
      return null;
    },
  };
}
