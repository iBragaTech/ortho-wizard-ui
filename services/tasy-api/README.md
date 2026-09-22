# API Tasy

## Modo independente do portal

O backend agora oferece autenticação própria e banco local persistente, sem depender
da `pc14121`. Siga o [guia do backend independente](../../docs/backend-independente.md).
Use `npm run portal:init` e `npm run portal:start`.

As instruções Supabase abaixo documentam o modo alternativo original, iniciado
com `npm start`.

Executar [diagnostico-postgres.sql](sql/diagnostico-postgres.sql) no banco
`ortho_wizard` para conferir estrutura e cadastro sem consultar senhas/hashes.
`db/schema.sql` sozinho não inclui `senha_hash` nem a função `verificar_login`;
não presumir que as migrações Supabase tenham sido aplicadas no banco local.
Não executar essas migrações indiscriminadamente: algumas dependem de roles
do Supabase e contêm alterações de senha do protótipo.

Serviço Node.js separado do frontend, para rodar na rede do hospital.

O guia de configuração, contrato HTTP, limitações e homologação está em
[docs/integracao-tasy.md](../../docs/integracao-tasy.md).

Consultas de diagnóstico Oracle:
[sql/diagnostico-tasy.sql](sql/diagnostico-tasy.sql).

## Ambiente de homologação informado pela TI

- Oracle 19c, com banco de homologação disponível.
- Servidor Windows.
- Usuário Tasy: `arafaela`; estabelecimento: `2`; perfil: `1848`.

Esses valores estão em `principals.example.json`. Substituir a chave
`SUB_DO_USUARIO_NO_PROVEDOR_DE_IDENTIDADE` pelo UUID do usuário no Supabase Auth
ao preparar `principals.local.json`. O perfil Tasy `1848` não é o UUID Supabase
nem o perfil visual do portal.

O exemplo permite inicialmente apenas a consulta do próprio usuário Tasy.
Para a etapa de pessoa física, configurar as operações e o escopo de acesso
conforme o guia. As gravações continuam desabilitadas.

## Preparar no Windows

Executar os comandos abaixo na raiz do projeto. Eles preservam arquivos locais
de configuração que já existam. Preencher `.env` localmente com o host, porta e
service name do Oracle de homologação, credenciais exclusivas da integração,
origem HTTPS do portal e dados públicos do projeto Supabase.

```powershell
cd services/tasy-api
npm ci
if (!(Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
if (!(Test-Path -LiteralPath principals.local.json)) {
  Copy-Item -LiteralPath principals.example.json -Destination principals.local.json
}
# Preencher os arquivos locais antes de iniciar.
npm start
```

Se `principals.local.json` já existir, atualizar somente o principal correto com
os valores confirmados (`tasyEstablishment: 2`, `tasyProfile: 1848`).
O próximo teste é `usuarios.consultar` com o token de acesso desse usuário Auth.
`/health/live` sozinho não testa a conexão Oracle. Não usar credenciais do Tasy
como senha Supabase: são identidades distintas, vinculadas pela configuração.

Testes sem banco ou credenciais:

```powershell
npm test
# Alternativa em ambientes que impedem processos filhos (Node 22+ compatível):
node --test --test-isolation=none test/api.test.mjs test/pessoa-fisica.test.mjs
```

Os testes simulam o driver Oracle; não substituem a homologação no Tasy.
