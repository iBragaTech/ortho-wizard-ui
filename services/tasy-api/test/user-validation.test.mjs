import test from "node:test";
import assert from "node:assert/strict";
import { parse, userSchema } from "../src/portal/auth.mjs";
import { linkFields } from "../src/portal/tasy-users.mjs";

test("Custos registration accepts valid passwords and reports the failing field without values", () => {
  const schema = userSchema.extend(linkFields).strict();
  const input = {
    nome: "Teste",
    email: "test@example.test",
    perfil: "Custos",
    senha: "test-only-password",
    nmUsuario: "teste",
    cdPerfil: 1848,
    cdEstabelecimento: 2,
  };
  for (const length of [12, 128])
    assert.equal(parse(schema, { ...input, senha: "x".repeat(length) }).perfil, "Custos");
  for (const [field, value, label] of [
    ["senha", "x".repeat(129), "Senha inicial"],
    ["senha", "short", "Senha inicial"],
    ["perfil", "INVALID_ROLE", "Perfil inválido"],
    ["email", "invalid-email", "E-mail"],
    ["nmUsuario", "x".repeat(16), "Usuário Tasy"],
    ["cdPerfil", 0, "Código do perfil"],
    ["cdEstabelecimento", 1.5, "Código do estabelecimento"],
  ]) {
    assert.throws(
      () => parse(schema, { ...input, [field]: value }),
      (error) => {
        assert.equal(error.code, "INVALID_INPUT");
        assert.ok(error.message.startsWith(label));
        assert.ok(!error.message.includes(input.senha));
        if (field !== "senha") assert.ok(!error.message.includes("Senha"));
        return true;
      },
    );
  }
});
