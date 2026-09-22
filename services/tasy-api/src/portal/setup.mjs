import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { openDatabase, migrate } from "./database.mjs";
import { createUser } from "./auth.mjs";
let db;
try {
  db = await openDatabase();
  await migrate(db);
  const { rows } = await db.query("SELECT count(*)::integer AS count FROM portal.users");
  if (rows[0].count > 0) {
    console.log("Base inicializada. Usuários existentes preservados; nenhuma senha foi alterada.");
  } else {
    const password = randomBytes(24).toString("base64url");
    const credentials = resolve("./.local/primeiro-acesso.txt");
    await mkdir(resolve("./.local"), { recursive: true });
    await writeFile(
      credentials,
      `E-mail: amanda.rafaela@he.org.br\nSenha: ${password}\nBackend local: http://127.0.0.1:3100\n`,
      { flag: "wx", mode: 0o600 },
    );
    let user;
    try {
      user = await db.transaction(async (tx) => {
        await tx.exec("LOCK TABLE portal.users IN EXCLUSIVE MODE");
        if ((await tx.query("SELECT id FROM portal.users LIMIT 1")).rows.length)
          throw new Error("Já existe usuário.");
        return createUser(tx, {
          nome: "Amanda Rafaela",
          email: "amanda.rafaela@he.org.br",
          perfil: "Administrador",
          senha: password,
        });
      });
    } catch (error) {
      await unlink(credentials);
      throw error;
    }
    const mappingPath = resolve("./.local/principals.suggested.json");
    await writeFile(
      mappingPath,
      JSON.stringify(
        {
          [user.id]: {
            enabled: true,
            tasyUsername: "arafaela",
            tasyEstablishment: 2,
            tasyProfile: 1848,
            operations: ["usuarios.consultar"],
            pessoaFisicaIds: [],
            canCreatePessoaFisica: false,
            allPessoaFisica: false,
          },
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    console.log(`Base criada. Primeiro acesso salvo somente em ${credentials}`);
    console.log(
      `Vínculo Tasy sugerido salvo em ${mappingPath}; integração permanece desabilitada.`,
    );
  }
} catch {
  console.error(
    "Falha ao preparar a base. Verifique configuração, permissões e arquivos locais existentes; nenhum arquivo existente é sobrescrito.",
  );
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
