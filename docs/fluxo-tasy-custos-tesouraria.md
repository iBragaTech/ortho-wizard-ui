# Fluxo com Custos e Tesouraria no Tasy

Definição solicitada: o médico cria no portal; após o envio, o Tasy controla
valores, itens e andamento. O portal recebe as alterações e gera o PDF para o
paciente. Custos e Tesouraria trabalham no Tasy.

## Etapas

1. Médico cria a solicitação: orçamento Tasy em `5 — Aguardando cotação`.
2. Custos revisa itens/valores no Tasy e muda para `1 — Em aprovação`.
3. Portal recebe os valores e o status; médico gera o PDF e envia ao paciente.
4. Paciente realiza o pagamento no hospital.
5. Tesouraria anexa o comprovante ao orçamento no Tasy; o portal reconhece a
   aprovação pela presença do comprovante tipo 1, sem exigir status 2.

## Mapeamento confirmado no HML

- Status: `ORCAMENTO_PACIENTE.IE_STATUS_ORCAMENTO`, descrição por
  `obter_valor_dominio(31, IE_STATUS_ORCAMENTO)`.
- Códigos encontrados: 1 Em aprovação; 2 Aprovado; 3 Cancelado pelo paciente;
  4 Cancelado pelo estabelecimento; 5 Aguardando cotação; 6 Aguardando documentação.
- Documento: `ORCAMENTO_PAC_DOC.NR_ORC_PAC` vincula o orçamento;
  `NR_SEQ_TIPO_DOC` referencia `TIPO_DOCUMENTO_ORC.NR_SEQUENCIA`.
- No estabelecimento 2, o tipo ativo `1` é Comprovante de Pagamento e o tipo
  `2` é Pedido Médico. No estabelecimento 8, o comprovante tem código `4`.
  Portanto, qualquer anexo não pode ser tratado como comprovante.

## Pontos da implementação

- Sincronizar os orçamentos vinculados pela tabela
  `TASY.AEBMG_PORTAL_ORCAMENTO_ENVIO`, incluindo revisões de valores e itens.
- Exibir a descrição de status do Tasy, respeitando cancelamentos e pendências.
- Liberar o PDF em Em aprovação com os valores atualizados, antes do pagamento.
- Retirar aprovação e ajuste local de valores para os orçamentos geridos pelo Tasy.
- Não aprovar sem comprovante de pagamento válido associado ao orçamento.
- Preservar a última leitura em falhas de conexão, indicando a atualização pendente.

## Regra de aprovação confirmada

O comprovante com `NR_SEQ_TIPO_DOC=1` sozinho aprova o orçamento no portal,
mesmo que o status Tasy ainda não seja 2. Cancelamentos continuam prevalecendo.
Um status 2 sem comprovante permanece pendente no portal.

Também não se deve inferir mudança de status apenas por `DT_ATUALIZACAO`:
uma alteração de valores deve refletir no portal, mas o avanço para Em aprovação
deve acompanhar a mudança explícita feita por Custos no Tasy.

## Implementação e ativação

A configuração local está definida com `TASY_RETURN_SYNC_ENABLED=true` e
`TASY_APPROVAL_RULE=document`. Reinicie a API no terminal para carregar o retorno
e a regra confirmada. A alternativa `status_and_document` existe no código,
mas não corresponde ao fluxo escolhido para este ambiente.

O worker consulta a cada 30 segundos, em lotes de até 100 orçamentos confirmados,
priorizando os menos recentemente consultados. O detalhe do portal atualiza a
cada 15 segundos. As consultas usam a ligação do portal, paciente e estabelecimento
originais e uma transação Oracle somente leitura. Não há novos objetos Oracle.

Os valores dos itens já são totais, não são multiplicados novamente pela
quantidade. O total final vem de `TASY.OBTER_VALOR_ORC_PAC`; descontos e diferenças
do total nativo aparecem no PDF como ajustes do Tasy. Itens agendáveis excluídos
do total são informativos. Valores ausentes impedem gerar um documento financeiro
incompleto. A validade do PDF vem do orçamento Tasy.

O comprovante é identificado por `NR_SEQ_TIPO_DOC=1` no orçamento vinculado,
conforme a regra informada. Cancelamento sempre prevalece sobre o comprovante.
Um Tasy aprovado sem comprovante fica pendente no portal, com explicação.

A base local mantém a última leitura para exibição e marca falhas sem substituir
valores por zero. A impressão exige leitura bem-sucedida há menos de dois minutos.
Eventos de atualização são registrados apenas quando há mudança no retorno.
Os orçamentos geridos pelo Tasy não aceitam ajustes/aprovação locais, inclusive
via API. A edição do telefone continua disponível.
