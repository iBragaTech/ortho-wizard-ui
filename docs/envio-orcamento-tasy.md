# Inclusão automática de solicitações no Tasy

## Funcionamento

Com `TASY_ENABLED=true`, `TASY_WRITES_ENABLED=true` e
`TASY_BUDGET_EXPORT_ENABLED=true`, criar uma solicitação no portal também inicia
sua inclusão no Tasy, no status **5 — Aguardando cotação**. O portal envia paciente,
convênio, categoria, procedimentos, materiais/OPME e as quantidades selecionadas.
O usuário, estabelecimento e perfil são obtidos do vínculo Tasy validado no servidor.

A seção **Registro no Tasy**, nos detalhes da solicitação, mostra o número retornado.
Solicitações anteriores à ativação podem ser incluídas pelo botão dessa seção.
Não é necessário aprovar por Custos para fazer a inclusão inicial.

A análise e aprovação de Custos continuam no portal. O conteúdo inicial enviado
permanece preservado; revisões posteriores de itens, valores e status do portal
não são sincronizadas automaticamente com o orçamento já criado no Tasy.
O envio não executa rotinas de fechamento nem confirma preços finais.
As triggers nativas continuam ativas e podem preencher valores conforme as regras do ERP.

## Persistência, repetição e falhas

A solicitação e sua fila de envio são salvas na mesma transação local. A migração 5
acrescenta o estado `queued` sem recriar dados existentes. O navegador mantém uma
chave por solicitação: repetir a criação após perda da resposta recupera a mesma
solicitação do mesmo usuário, sem criar outra.

- `queued`: inclusão aguardando processamento; a API verifica a fila a cada 30 segundos e ao iniciar.
- `sending`: tentativa em andamento.
- `confirmed`: gravação confirmada, com número do Tasy.
- `unknown`: sem confirmação; usar **Reconciliar envio** na mesma solicitação.

A criação local retorna seu identificador mesmo quando o envio falha. O portal
informa a pendência e preserva os dados para reconciliação. Envios interrompidos
quando a API é reiniciada ficam sem confirmação, disponíveis para reconciliação.

O UUID local e o hash do conteúdo são registrados em `TASY.PORTAL_ORCAMENTO_ENVIO`
na mesma transação Oracle que insere cabeçalho, procedimentos, materiais e histórico.
A chave única impede uma segunda inclusão da mesma solicitação. A reconciliação
reutiliza o conteúdo e o vínculo original, mesmo se a análise local tiver avançado.
Nunca apagar o registro de controle para forçar novo envio.

O histórico guarda o responsável, início, confirmação e falhas. Consultas ao Tasy
revalidam pessoa/CPF, catálogo, vínculo de usuário e escopo de pacientes.
Orçamentos sem os identificadores Tasy completos não podem ser enviados.

## Implantação em outro ambiente

1. Revisar o script `services/tasy-api/sql/portal-orcamento-envio.sql`, as triggers
   e os privilégios da conta de integração antes de criar a tabela de controle.
2. Configurar as três variáveis acima e os vínculos individuais Tasy.
   Usuários ativos com permissão de consulta de pacientes recebem a operação de
   envio para o escopo que já possuem; nenhuma identidade é recebida do navegador.
3. Reiniciar a API. A migração local é aplicada automaticamente.
4. Conferir uma inclusão, quantidades, status, usuário e histórico no ambiente de destino.

## Validação em homologação — 24/09/2026

A tabela de controle foi criada em **TASYHML**. A solicitação **SOL-2026-000001**
foi registrada como orçamento **13490**, estabelecimento **2**, status **5**.
Foram conferidos um procedimento, dois materiais e suas quantidades. Uma segunda
chamada retornou o mesmo número com `recuperado=true`.

Os testes automatizados verificam inclusão automática pela API, fila persistente,
repetição da criação, falha Oracle sem perda da solicitação, reconciliação com o
mesmo conteúdo e continuidade da aprovação por Custos.
