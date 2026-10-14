# Log inicial dos orçamentos do painel

A tabela `TASY."AEBMG_PAINEL_ORÇAMENTO_LOG"` guarda um registro por orçamento
enviado pelo painel. O nome contém Ç e deve ser usado entre aspas nas consultas.

`SNAPSHOT_PORTAL` preserva os dados da criação, incluindo paciente, itens,
quantidades, valores e observações. `CABECALHO_TASY`, `PROCEDIMENTOS_TASY` e
`MATERIAIS_TASY` preservam todas as colunas das respectivas linhas após as
triggers de inserção. Os documentos são JSON em CLOB, sem limite de 4.000 caracteres.
O registro identifica o orçamento, solicitação, usuário do portal, usuário Tasy,
estabelecimento, perfil, data e hash SHA-256 da cópia original.

O exportador grava o log antes do commit, na mesma transação do orçamento. Uma
falha no log desfaz o envio inteiro. Reenvios confirmados recuperam o número
original sem duplicar ou substituir o log. Uma trigger impede UPDATE e DELETE.
Não há chave estrangeira para permitir a preservação do log após exclusão do
orçamento original. Contas com poderes administrativos continuam capazes de
alterar a estrutura; a conta da integração deve ter apenas SELECT e INSERT no log.

O escopo é o envio inicial pelo painel. Não registra criações feitas diretamente
no Tasy, nem reconstrói o estado inicial de orçamentos antigos. Não é um histórico
de todas as alterações. Não modifica triggers das tabelas nativas.

Instalação com as credenciais Oracle configuradas em `services/tasy-api`:

```powershell
node --env-file=.env.portal src/install-budget-log.mjs
```

O instalador recusa uma tabela já existente para evitar sobrescrever sua estrutura.
DDL Oracle confirma a criação imediatamente. Após atualizar o backend, os novos
envios passam a gravar o log automaticamente.

Consulta:

```sql
SELECT NR_ORCAMENTO, ID_PORTAL, NM_USUARIO, DT_REGISTRO,
       SNAPSHOT_PORTAL, CABECALHO_TASY, PROCEDIMENTOS_TASY, MATERIAIS_TASY
FROM TASY."AEBMG_PAINEL_ORÇAMENTO_LOG"
WHERE NR_ORCAMENTO = :nr_orcamento;
```
