import { z } from "zod";
const code = z.string().regex(/^\d{1,15}$/);
export const quantity = z.number().int().min(1).max(10000).default(1);
export const tasySelection = z
  .object({
    cdPessoaFisica: z.string().regex(/^\d{1,10}$/),
    cdConvenio: code,
    convenioNome: z.string().trim().max(200).optional(),
    cdCategoria: z.string().min(1).max(10),
    categoriaNome: z.string().trim().max(200).optional(),
    procedimentos: z
      .array(z.object({ codigo: code, origem: code, quantidade: quantity }).strict())
      .min(1)
      .max(50),
    materiais: z.array(z.object({ codigo: code, quantidade: quantity }).strict()).max(100),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.procedimentos.map((p) => `${p.codigo}:${p.origem}`)).size ===
        v.procedimentos.length &&
      new Set(v.materiais.map((m) => m.codigo)).size === v.materiais.length,
    "Itens duplicados.",
  );
