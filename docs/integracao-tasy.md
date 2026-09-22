# Integração Oracle / Tasy

## Estado desta implementação

- API Node.js em `services/tasy-api`, independente da hospedagem do portal.
- Validação de JWT do Supabase Auth por chave pública (JWKS), emissor, audiência e expiração.
- Permissões mantidas no servidor e verificação de acesso por pessoa física.
- Pool Oracle, parâmetros SQL separados dos valores, limite de requisições e auditoria técnica.
- Consulta de `USUARIO` e de `PESSOA_FISICA`.
- Inserção e alteração dos campos informados pela TI: `CD_PESSOA_FISICA`,
  `NM_PESSOA_FISICA`, `DT_NASCIMENTO`, `NR_CPF`.
- Escrita desabilitada por padrão; geração pela trigger confirmada, contexto de sessão e regras de cadastro pendentes de homologação.
- Cliente TypeScript com token Supabase e modo opcional de login real no portal.

Não houve conexão com Oracle nem alteração em dados reais. As telas de orçamento
ainda persistem no banco do portal. O cliente Tasy está disponível para a próxima
etapa de associação entre paciente do portal e pessoa física do Tasy; não existe
sincronização automática ou transação distribuída entre os dois bancos.

## Rede e execução

```text
Navegador -> Supabase Auth (login)
Navegador -> HTTPS / proxy do hospital -> API Node -> Oracle interno
```

Hospedar a API em Windows/Linux com Node 22+ e acesso privado ao Oracle.
Publicar somente o proxy HTTPS, com encaminhamento à porta local 3100;
o padrão `HOST=127.0.0.1` pressupõe proxy na mesma máquina. Se o proxy estiver em
outra máquina, ajustar bind e firewall para permitir somente sua origem.
O navegador externo precisa alcançar o endereço HTTPS da API; uma URL DNS
somente interna não funciona para esses usuários. Não publicar o listener Oracle.

`trustProxy=false`: cabeçalhos encaminhados não são confiados. O limite local é
60 requisições/minuto por IP. Atrás do proxy, esse limite pode ser compartilhado
por todos os usuários; configurar limites por usuário/IP no proxy e revisar a
política antes da publicação. Com múltiplas instâncias, usar um limitador central.
CORS permite apenas `PORTAL_ORIGIN`; não substitui autenticação.

O usuário Oracle deve ser exclusivo da integração, com acesso mínimo aos objetos
necessários. Pessoa física usa o owner confirmado `TASY`; a consulta `usuario`
ainda exige sinônimo privado ou adaptação para o owner confirmado desse objeto.
Não usar o usuário administrativo do Tasy.

## 1. Descobrir estrutura e geração do código

Executar [diagnostico-tasy.sql](../services/tasy-api/sql/diagnostico-tasy.sql)
no SQL Developer. O arquivo consulta versão, owner, colunas obrigatórias,
triggers, dependências, constraints e índices únicos. Não consome sequence.

Confirmar:

1. Versão do Oracle e requisitos de criptografia/conexão.
2. Tipos e tamanhos reais dos quatro campos, demais campos obrigatórios,
   defaults e triggers de auditoria/regra de negócio.
3. Rotina que realmente gera `CD_PESSOA_FISICA`. Ser sequencial não implica
   necessariamente uma sequence Oracle diretamente consumível pelo portal.
4. Se uma trigger já gera/substitui o código. Neste caso adaptar para a trigger
   e usar `RETURNING`, em vez de consumir uma sequence separadamente.
5. Regras de CPF, unicidade e cadastro do Tasy, incluindo eventual procedure
   obrigatória. A validação inicial da API exige CPF com 11 dígitos e uma data
   existente, não futura; não substitui validações cadastrais do ERP.

Não usar `MAX(CD_PESSOA_FISICA) + 1`. O código enviado pela TI confirmou que
`TASY.PESSOA_FISICA_INSERT` consome `PESSOA_FISICA_SEQ` quando o código é
`@SEQUENCE` e `get_ie_executar_trigger = 'S'`. A API usa esse marcador e
`RETURNING`, sem consumir a sequence diretamente. A opção antiga
`ORACLE_PESSOA_FISICA_SEQUENCE` foi removida; retire-a de configurações locais.

O driver começa em modo Thin. Quando necessário, configurar Oracle Instant
Client e `ORACLE_CLIENT_LIB_DIR` para Thick, conforme a versão/rede do hospital.
No Linux o carregamento também exige configuração do loader do sistema.

## 2. Configurar Supabase Auth

No projeto Supabase, provisionar contas reais de Auth. As contas em
`public.portal_users` e as senhas do RPC `verificar_login` **não são migradas
automaticamente**.

Usar uma chave assimétrica de assinatura (ES256 ou RS256), com chave pública
disponível no endpoint JWKS. O segredo legado HS256 não é aceito por esta API.

Configurar somente no `.env` da API:

```dotenv
AUTH_ISSUER=https://SEU-PROJETO.supabase.co/auth/v1
AUTH_AUDIENCE=authenticated
AUTH_JWKS_URL=https://SEU-PROJETO.supabase.co/auth/v1/.well-known/jwks.json
AUTH_ALGORITHM=ES256
```

Usar os valores reais do seu projeto (incluindo domínio personalizado, se houver).
O servidor precisa de saída HTTPS para o JWKS. Não recebe senha Supabase,
segredo de assinatura ou chave `service_role`.

Para o modo de login do portal, atribuir por um processo administrativo seguro
`app_metadata.portal_perfil` com um destes valores: `Administrador`, `Comercial`
ou `Médico`. Não usar `user_metadata` para conceder perfis. O nome de exibição
pode estar em `user_metadata.nome`.

Após provisionar as contas, configurar no build do portal:

```dotenv
VITE_PORTAL_AUTH_MODE=supabase
VITE_TASY_API_URL=https://api.exemplo.com.br
```

Os valores públicos Supabase existentes continuam sendo usados. Nesse modo,
o formulário de login chama `signInWithPassword`; a sessão acompanha os eventos
de Auth, e sair encerra a sessão local e limpa o cache das consultas. O cadastro
de novos acessos deve ser feito pela administração de identidade; a antiga RPC
de criação de usuário não cria contas Auth e não é chamada nesse modo.

Sem a configuração, permanece o login legado de demonstração, que NÃO
autentica chamadas Oracle. Essa compatibilidade não torna o legado seguro para
publicação. As políticas `prototipo_acesso_total`, concessões anônimas e RPCs
legadas do banco do portal ainda precisam ser substituídas antes do acesso
externo com dados reais; esta entrega não altera essas políticas.

## 3. Permissões da API

Copiar `principals.example.json` para `principals.local.json`, fora do Git.
A chave é o UUID (`sub`) do usuário no Supabase Auth, não seu e-mail.

Exemplo de escopo limitado de homologação (códigos fictícios):

```json
{
  "UUID-DO-AUTH": {
    "enabled": true,
    "tasyUsername": "arafaela",
    "operations": ["usuarios.consultar", "pessoas-fisicas.consultar", "pessoas-fisicas.salvar"],
    "pessoaFisicaIds": ["123"],
    "canCreatePessoaFisica": false,
    "allPessoaFisica": false
  }
}
```

- `usuarios.consultar` só consulta o nome Tasy associado ao próprio usuário.
- `pessoaFisicaIds` autoriza leitura/alteração dos códigos listados.
- `canCreatePessoaFisica` permite criar cadastros, além da permissão da operação.
- `allPessoaFisica=true` concede leitura/alteração de QUALQUER pessoa física
  para as operações autorizadas. Reservar a contas administrativas que realmente
  precisem desse alcance; não aplicar por padrão a médicos/usuários externos.
- Quem tem permissão somente de criação não recebe automaticamente acesso
  futuro ao registro criado. Vincular o novo código à sua autorização, se necessário.
- Reiniciar o serviço após alterações nesse arquivo. Em produção, substituir
  listas estáticas por vínculos institucionais geridos no servidor quando necessário.

O perfil visual do portal e claims customizados enviados pelo navegador não
concedem acesso ao Oracle. A API sempre consulta sua configuração de permissões.
JWTs já emitidos podem continuar válidos até expirar mesmo após logout;
para bloqueio imediato, desabilitar o principal e reiniciar as instâncias.

## 4. Iniciar a API

```powershell
cd services/tasy-api
npm ci
Copy-Item .env.example .env
Copy-Item principals.example.json principals.local.json
# Editar os arquivos com valores de homologação.
npm start
```

Manter `.env`, arquivo de permissões e qualquer módulo local de operações com
acesso restrito à conta do serviço/TI. Não colocar segredos em variáveis `VITE_*`.
`GET /health/live` verifica apenas que o processo responde, não a conexão Oracle.
Validar a conexão pela consulta autenticada de usuário.

Logs incluem identificador da requisição, sujeito autenticado, operação e resultado.
Não registram corpo, CPF, nascimento, token ou texto bruto de erros Oracle.
Encaminhar logs para armazenamento com acesso/retenção definidos pela instituição
e habilitar a auditoria Oracle adequada. Esses logs técnicos não substituem
histórico cadastral durável dos valores alterados.

## 5. Contrato HTTP

Todas as operações: `POST /v1/operations/{nome}`, com
`Authorization: Bearer <access_token>` e `Content-Type: application/json`.
Consultas usam POST para evitar CPF/dados cadastrais em URLs e logs de acesso.

| Operação                    | Entrada                               | Comportamento                                 |
| --------------------------- | ------------------------------------- | --------------------------------------------- |
| `usuarios.consultar`        | `nmUsuario`                           | Retorna o próprio usuário Tasy vinculado      |
| `pessoas-fisicas.consultar` | `cdPessoaFisica`                      | Retorna os quatro campos autorizados          |
| `pessoas-fisicas.salvar`    | Nome, nascimento, CPF                 | Insere, obtendo código da sequence confirmada |
| `pessoas-fisicas.salvar`    | Os mesmos campos, código e `anterior` | Altera um cadastro existente                  |

Consulta:

```json
{ "cdPessoaFisica": "123" }
```

Para inclusão, omitir `cdPessoaFisica` e `anterior`. Para alteração, enviar
o código e em `anterior` os valores devolvidos pela última consulta
(`nmPessoaFisica`, `dtNascimento`, `nrCpf`). Nome, data ISO `YYYY-MM-DD` e CPF
sem pontuação são obrigatórios nos novos valores.

A alteração bloqueia o registro por tempo limitado e compara os valores
anteriores para evitar sobrescrever uma edição concorrente desses campos.
Código informado mas inexistente retorna 404; não cria um cadastro com um código
arbitrário. CPF existente em uma inclusão retorna 409, sem alterar outra pessoa
silenciosamente. A decisão de vínculo/atualização depende de consulta autorizada.

Sucesso: `{ "data": { ... }, "requestId": "..." }`.
Erro: `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`.
400 = entrada inválida; 401 = token inválido; 403 = permissão/escrita bloqueada;
404 = operação/registro ausente; 409 = conflito; 501 = mapeamento pendente;
503 = erro de integração ou resultado de commit incerto.

Não repetir gravações automaticamente. Um timeout/perda da confirmação pode
ocorrer depois de o Oracle gravar. `WRITE_OUTCOME_UNKNOWN` exige reconciliação;
erros de rede no cliente também exigem conferir antes de repetir. Não foi
implementada uma fila persistente ou idempotência durável entre requisições.

## 6. Habilitar gravação em homologação

Somente depois de validar o diagnóstico e a rotina de cadastro:

```dotenv
TASY_WRITES_ENABLED=true
TASY_PESSOA_FISICA_DML_ENABLED=true
```

Os dois bloqueios vêm desabilitados. A API controla commit/rollback.
Procedures/triggers com commit próprio ou transações autônomas não podem ter
seus efeitos desfeitos por esse rollback: identificar antes de integrar.

O adaptador direto é uma implementação inicial dos campos informados, não uma
certificação das regras de cadastro do Tasy. Se o ambiente exigir mais campos,
contexto de sessão, auditoria adicional ou uma procedure, adaptar antes de habilitar.
O diagnóstico recebido confirmou código VARCHAR2(10), nome VARCHAR2(60),
usuário VARCHAR2(15), CPF VARCHAR2(11), nascimento/atualização DATE e
estabelecimento NUMBER. A API limita nome a 60 caracteres, código a 10 dígitos
e usuário a 15 caracteres. Confirmar `CHAR_USED` e o charset para validar também
os limites em bytes de nomes acentuados. Só o código está marcado NOT NULL na
tabela; nome, nascimento e CPF permanecem obrigatórios na API pela regra
informada pela TI. O nome retornado pela consulta pode ser nulo em registros legados.

A escrita informa `NM_USUARIO` a partir do principal autenticado e
`DT_ATUALIZACAO = SYSDATE`; na inclusão também informa `CD_ESTABELECIMENTO`.
Configurar no principal os números `tasyEstablishment` e `tasyProfile` somente
após confirmar os vínculos autorizados. Não são parâmetros aceitos no corpo HTTP.
Antes de gravar, a API verifica usuário, estabelecimento, perfil e habilitação
das triggers no pacote Tasy. As assinaturas foram confirmadas pelo passo 9:
`SET_NM_USUARIO(NM_USUARIO_P)`, `SET_CD_ESTABELECIMENTO(CD_ESTABELECIMENTO_P)`,
`SET_CD_PERFIL(CD_PERFIL_P)` e `SET_IE_EXECUTAR_TRIGGER(IE_EXECUTAR_P)`.
A API chama essas rotinas com binds na própria conexão da gravação, após
autorizar o registro, e verifica os valores retornados pelos getters antes do DML.
O valor de execução de triggers é sempre `S`.

Conexões de escrita são encerradas com `close({ drop: true })` tanto no sucesso
quanto na falha, inclusive em inicialização parcial. Isso descarta a sessão física
e evita reutilizar estados adicionais alterados pelas triggers/pacotes.
O custo é uma nova conexão física em gravações subsequentes; medir em homologação.
Conexões de leitura continuam no pool, salvo erro no rollback.
As assinaturas confirmam os parâmetros, não o comportamento interno nem todos
os requisitos da aplicação Tasy: homologar o fluxo com usuário/perfil/estabelecimento
autorizados antes de habilitar escrita. Os códigos não podem ser inventados nem
obtidos de campos editáveis no navegador.

O arquivo de triggers recebido contém `PRAGMA AUTONOMOUS_TRANSACTION` e
commits em `PESSOA_FISICA_UPDATE_HL7`. Conforme os parâmetros ativos, podem
ocorrer efeitos em integrações que sobrevivem ao rollback da transação principal.
Homologar com as integrações do ambiente de teste e não prometer rollback integral.

**Concorrência na inclusão:** a busca prévia por CPF não garante unicidade
entre duas transações simultâneas. Só habilitar inclusão direta se o banco já
garantir a unicidade cadastral necessária por constraint/índice/regra homologada.
Se permitir CPFs repetidos ou exigir regras próprias, usar a rotina oficial de
cadastro; não adicionar constraints nas tabelas do ERP sem análise específica.

Não criar uma sequence paralela para o portal. Lacunas em sequences são normais,
inclusive quando uma transação é revertida.

## 7. Consumo pelo projeto

Depois do login real e da configuração, o cliente está disponível assim:

```ts
import { getTasyClient } from "@/lib/data/tasy-supabase";

const tasy = getTasyClient();
const pessoa = await tasy.consultarPessoaFisica(codigoAutorizado);

await tasy.salvarPessoaFisica({
  cdPessoaFisica: pessoa.cdPessoaFisica,
  nmPessoaFisica: novoNome,
  dtNascimento: novaDataIso,
  nrCpf: novoCpfSemPontuacao,
  anterior: {
    nmPessoaFisica: pessoa.nmPessoaFisica,
    dtNascimento: pessoa.dtNascimento,
    nrCpf: pessoa.nrCpf,
  },
});
```

O cliente obtém o access token da sessão Supabase. A API verifica a assinatura
e autorização independentemente do navegador. Não enviar chave de serviço no frontend.

Próxima etapa funcional: definir onde buscar/editar pessoa física nas telas e
armazenar a relação entre o paciente do portal e `CD_PESSOA_FISICA`. Não vincular
automaticamente por nome nem tentar confirmar gravações nos dois bancos como
se fossem uma única transação.

## Testes e fontes

`npm test` dentro do serviço testa autenticação, autorização, validação,
SQL parametrizado, transações, bloqueio de escrita e conflitos usando um driver
simulado. Homologar separadamente conexão, grants, triggers, sequence e regras
com dados de teste do hospital.

- [Oracle: conexões e pools](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html)
- [Oracle: bind variables](https://node-oracledb.readthedocs.io/en/latest/user_guide/bind.html)
- [Oracle: transações](https://node-oracledb.readthedocs.io/en/latest/user_guide/txn_management.html)
- [Supabase: validação de JWT/JWKS](https://supabase.com/docs/guides/auth/jwts)
- [Supabase: chaves de assinatura](https://supabase.com/docs/guides/auth/signing-keys)
