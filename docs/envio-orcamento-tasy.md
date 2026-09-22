# Envio de orçamento ao Tasy — implementação para homologação

## O que está implementado

No detalhe do orçamento, a seção **Registro no Tasy** permite enviar e reconciliar
um orçamento. O envio cria ORCAMENTO_PACIENTE no status 5 (Aguardando cotação,
conforme exemplo fornecido pela TI), seus procedimentos e materiais OPME, com
quantidade 1 por item. As sequences nativas fornecem os códigos. O primeiro
procedimento é a referência dos adicionais e materiais.

Os identificadores de paciente, convênio, categoria, código/origem dos procedimentos
e materiais são persistidos em campos estruturados nos novos orçamentos locais.
O backend revalida CPF/pessoa, permissões e itens ativos antes da inclusão.

NM_USUARIO, estabelecimento e perfil vêm do vínculo mantido no servidor. Datas
Oracle usam SYSDATE; o controle usa SYSTIMESTAMP. Um registro explícito em
ORCAMENTO_HISTORICO guarda a origem, UUID local, UUID do responsável e os totais
informados no portal, identificados como valores ainda não precificados no ERP.
As triggers existentes continuam ativas.

O portal registra início, reconciliação, confirmação e falha em portal.events,
com data/hora e usuário autenticado. portal.tasy_exports preserva a cópia do
conteúdo enviado, responsável, usuário Tasy, estado e número retornado.

## Limitações explícitas

- Envia para cotação, não como orçamento com preços finais. Não executa
  GERAR_CONSULTA_PRECO nem distribui totais manuais entre parcelas Oracle.
- Ainda exige paciente já cadastrado e acessível ao usuário. A inclusão automática
  de pessoa física não faz parte deste envio.
- Orçamentos antigos sem os identificadores estruturados não são exportados.
- Após iniciar o envio, a edição local fica bloqueada para preservar o conteúdo.
  Atualização de orçamento já exportado e cancelamento/reabertura exigem fluxo próprio.
- Quantidades configuráveis, precificação e histórico detalhado de negociação
  por parcela ainda precisam de implementação. A cópia preserva o estado no envio,
  não substitui um histórico de todas as edições anteriores.
- Não houve INSERT real no Oracle para validar esta implementação. Os testes do
  escritor Oracle usam simulação; os testes de estado local usam PostgreSQL/PGlite.

## Ativação em homologação

1. Com o DBA, revisar `services/tasy-api/sql/portal-orcamento-envio.sql` e executar
   na homologação. A tabela TASY.PORTAL_ORCAMENTO_ENVIO precisa estar no mesmo
   banco e participar da mesma transação dos registros nativos. Seu papel é
   garantir que a chave UUID do portal corresponda a somente um orçamento.
2. Conceder à conta de integração somente as permissões necessárias: tabelas,
   sequences, contexto de sessão e histórico usados em `src/orcamento-export.mjs`.
3. Revisar triggers de cabeçalho, procedimentos e materiais, dependências e
   histórico. Confirmar status 5 e os campos obrigatórios de negócio. Nenhuma
   rotina chamada por triggers pode confirmar parcialmente esta transação;
   transações autônomas devem ser avaliadas separadamente.
4. No vínculo do usuário local, adicionar `orcamentos.enviar` em `operations`.
   Manter o escopo de pessoas explicitamente autorizado, estabelecimento e perfil.
5. Em `.env.portal`, configurar:

   ```dotenv
   TASY_BUDGET_EXPORT_ENABLED=true
   TASY_WRITES_ENABLED=true
   TASY_PESSOA_FISICA_DML_ENABLED=false
   ```

   A chave de gravação global também afeta outras operações permitidas. Não
   liberar operações adicionais no vínculo sem necessidade.
6. Reiniciar `npm run portal:start`. A migração local 2 cria a tabela de envios
   sem recriar o banco nem alterar usuários e orçamentos existentes.
7. Criar um novo orçamento com paciente Tasy, convênio/categoria e procedimento
   principal; conferir itens e usar **Enviar ao Tasy para cotação** nos detalhes.
8. Conferir cabeçalho, itens, quantidades, usuário e histórico no Tasy. Só depois
   ampliar o uso. Gravação de produção não está habilitada por este trabalho.

## Falhas, repetição e relatórios

A chave de integração é o UUID do orçamento. O Oracle armazena também um hash
canônico do conteúdo. A chave é inserida na mesma transação dos itens: outra
tentativa não deve gerar uma segunda inclusão. Em perda de resposta, o portal
preserva estado desconhecido e permite **Reconciliar envio** com a mesma chave,
conteúdo e contexto. Não apagar a tabela de controle nem criar outro orçamento
para contornar uma resposta desconhecida.

Se o erro é de catálogo/permissão, a cópia permanece preservada. A correção ou
liberação exige análise administrativa; não há botão para descartar uma tentativa
cujo resultado ainda possa existir no Oracle.

Para relatórios, relacionar portal.requests.id com portal.tasy_exports.request_id,
e tasy_id com ORCAMENTO_PACIENTE.NR_SEQUENCIA_ORCAMENTO. No Oracle, a tabela de
controle guarda ID_PORTAL, ID_USUARIO_PORTAL, NM_USUARIO, DT_ENVIO e NR_ORCAMENTO.
Restringir o acesso a esses dados às equipes autorizadas.
