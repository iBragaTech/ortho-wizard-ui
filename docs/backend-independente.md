# Backend e banco independentes

O portal pode funcionar nesta máquina sem acessar a `pc14121`, Supabase ou Lovable. O modo local usa PGlite: PostgreSQL embutido no processo Node, com dados persistidos em disco. Ele é destinado ao desenvolvimento; não abre uma porta PostgreSQL para o pgAdmin.

## Iniciar no Windows

Requisito: Node.js 22 ou superior. Em um terminal na raiz do projeto:

```powershell
cd services/tasy-api
npm ci
npm run portal:init
npm run portal:start
```

A configuração está em `services/tasy-api/.env.portal`, criada a partir de `.env.portal.example`. A inicialização preserva usuários existentes e não redefine senhas. Execute `portal:init` com o serviço parado.

Em outro terminal, na raiz do projeto:

```powershell
npm ci
npm run dev -- --port 5173
```

Abra `http://localhost:5173`. O arquivo `.env.local` da raiz seleciona `VITE_PORTAL_AUTH_MODE=local` e `VITE_PORTAL_API_URL=http://127.0.0.1:3100`. Reinicie o frontend ao alterar essas variáveis. A API responde em `http://127.0.0.1:3100/health/live`.

## Primeiro acesso e dados

- Administradora inicial: `amanda.rafaela@he.org.br`.
- Senha aleatória: abra `services/tasy-api/.local/primeiro-acesso.txt` localmente. Ela não é publicada nem gravada no código.
- Dados: `services/tasy-api/.local/pgdata`.
- A base começa sem pacientes e sem orçamentos. Cadastre usuários e médicos pelo portal.
- O cadastro de médicos é um diretório; o acesso exige também um usuário com perfil `Médico`.

Os arquivos locais e credenciais são ignorados pelo Git. Restrinja o acesso à pasta no Windows. Para uma cópia de segurança de desenvolvimento, pare a API antes de copiar a pasta de dados. Uma pasta PGlite não deve ser copiada para o diretório de um servidor PostgreSQL convencional.

Só execute uma instância da API por pasta PGlite. Um arquivo `pgdata.lock` impede abertura simultânea. Se o processo encerrar abruptamente, confirme que ele está parado antes de remover manualmente esse arquivo de bloqueio.

## API e permissões

- `POST /v1/auth/login`: `{ "email": "...", "senha": "..." }`.
- `GET /v1/auth/me`: usuário autenticado.
- `POST /v1/auth/logout`: revoga a sessão.
- `POST /v1/portal/:operation`: operações do portal, com `Authorization: Bearer <token>`.

Login retorna `{ "data": { "token": "...", "user": {} } }`. As sessões duram oito horas; o banco guarda somente o hash do token. Senhas usam scrypt. Desativação do usuário é verificada em cada requisição. As permissões são aplicadas pela API.

Médicos acessam solicitações próprias ou atribuídas a eles. Comercial e administradores acompanham o fluxo geral. Solicitações criadas pelo Comercial precisam de atribuição explícita antes de aparecerem para um médico. Essa atribuição está disponível na API, ainda sem controle específico na interface:

```text
POST /v1/portal/assignDoctor
Authorization: Bearer <token do administrador ou Comercial>
Content-Type: application/json

{"id":"UUID do orçamento","userId":"UUID do usuário médico"}
```

O novo esquema `portal` é criado por `src/portal/schema.sql`. Ele mantém usuários, sessões, diretório médico, solicitações, eventos e configurações. As solicitações guardam uma cópia dos dados informados em JSONB. Não execute `db/schema.sql` ou as antigas migrations Supabase para inicializar este modo.

## Tasy

### Inclusão automática de solicitações

Com `TASY_BUDGET_EXPORT_ENABLED=true` e gravações habilitadas, a criação inclui
a solicitação no Tasy como **Aguardando cotação**. O número e eventuais pendências
aparecem nos detalhes. A análise de Custos continua no portal. Veja
[envio automático e reconciliação](envio-orcamento-tasy.md).

### Atualização do telefone pelo médico

Ao selecionar um paciente existente na nova solicitação, o médico pode alterar o
telefone; nome, CPF e nascimento continuam bloqueados. O telefone alterado é salvo
no Tasy ao enviar a solicitação. Nos detalhes de um orçamento, **Editar telefone**
consulta o contato atual no Tasy e permite salvá-lo sem alterar os demais campos,
inclusive depois da aprovação (o conteúdo já enviado ao Tasy permanece preservado).

A operação `pessoas-fisicas.atualizar-telefone` grava somente celular, DDD e DDI
(número brasileiro com DDD, com `+55` opcional), além do usuário e data de auditoria.
Ela exige vínculo Tasy ativo, acesso ao paciente, `TASY_WRITES_ENABLED=true` e
`TASY_PESSOA_FISICA_DML_ENABLED=true`. O médico não recebe permissão para alterar
os outros dados de uma pessoa existente. Alterações simultâneas são recusadas;
nesse caso, consulte novamente o paciente antes de editar.

O portal só salva a alteração local depois da confirmação Oracle. As duas bases
não compartilham uma transação: se a confirmação da gravação for perdida, confira
o resultado antes de repetir. Reenviar o mesmo telefone não altera novamente o
cadastro; um telefone diferente registrado nesse intervalo gera conflito.

A integração começa com `TASY_ENABLED=false`; nenhuma conexão Oracle é necessária para desenvolver o portal. A criação de um orçamento local não grava automaticamente uma pessoa no ERP.

O arquivo `.local/principals.suggested.json` vincula o UUID da administradora a `arafaela`, estabelecimento `2`, perfil `1848`, permitindo apenas a consulta do próprio usuário Tasy. Para testar a integração, configure as variáveis Oracle e aponte `TASY_PRINCIPALS_FILE` para esse arquivo. Use exclusivamente o banco de homologação inicialmente.

As gravações continuam bloqueadas por `TASY_WRITES_ENABLED=false` e `TASY_PESSOA_FISICA_DML_ENABLED=false`. A liberação exige configurar operações e escopo de pessoas no vínculo do usuário. Veja [integração Tasy](integracao-tasy.md) para o contexto das triggers e validação da gravação; a configuração Supabase descrita ali é alternativa ao login local.

## Servidor Windows e acesso externo

O driver PostgreSQL convencional já está disponível: configure `PORTAL_DB_MODE=postgres`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` e TLS em `.env.portal`. Use uma base nova e um usuário próprio do serviço com permissão para criar o esquema `portal`. `PGSSLMODE=verify-full` valida o certificado; configure `PGSSLROOTCERT` quando necessário.

Essa troca inicializa uma base vazia no servidor. A transferência dos dados de desenvolvimento precisa de uma exportação/importação planejada; não é automática e ainda não foi validada neste projeto.

Para publicação, coloque a API atrás de HTTPS, configure `PORTAL_ORIGIN` com a origem exata do site e publique o frontend com a URL HTTPS da API. `localhost` no navegador de um visitante aponta para a máquina dele. PostgreSQL e Oracle devem ficar acessíveis somente pela rede interna do backend. A execução contínua como serviço Windows e a publicação HTTPS ainda precisam ser configuradas no servidor.

O site já publicado no Lovable não foi alterado por esta configuração local.

Referências: [PGlite](https://pglite.dev/docs/), [transações com node-postgres](https://node-postgres.com/features/transactions).
