# Referência de preços do Tasy em homologação

## Quantidades

Procedimentos, materiais e OPME agora aceitam quantidade inteira entre 1 e 10.000,
com padrão 1. Essa regra substitui a limitação anterior de uma unidade por item.
A API rejeita zero, nulo, negativos e frações; registros antigos sem quantidade
continuam sendo interpretados como uma unidade. Os preços nativos permanecem
unitários; o cálculo multiplica cada parcela pela quantidade antes de somar.
Confirmação de preço zero, PDF e o exportador de rascunho preservam as quantidades.
Campos obrigatórios são identificados com asterisco vermelho no formulário.

## Catálogo de procedimentos e diárias — atualização de 22/09/2026

A busca lista o cadastro `PROCEDIMENTO` ativo, com convênio e categoria ativos.
Não exige vínculo em `PROC_INTERNO_CONV`: a diária 60000694 (origem 8) está ativa,
mas não possui esse vínculo para o convênio 29. A inclusão na lista não confirma
cobertura; o preço vigente é calculado pela função nativa para a seleção feita.
Esta regra substitui a filtragem anterior por vínculos internos.

Na rotina nativa, a classificação 1 calcula as parcelas de procedimento; as demais
seguem o cálculo de serviço, que retorna apenas o total P. Nesse segundo caso,
o portal registra honorários zero e destina o preço ao valor hospitalar, preservando
o retorno nativo em `honorariosNativo`. Não aplica essa conversão a honorários
ausentes na classificação 1. Validado: 60000694 / origem 8 / convênio 29 /
categoria 4 = R$ 550,00 por unidade. A quantidade atual do portal continua 1 por item.

Os procedimentos selecionados (principal e adicionais) oferecem **Consultar valores
no Tasy**. A operação `precos.procedimento` usa `TASY.OBTER_PRECO_PROCEDIMENTO`, cuja
definição foi consultada na homologação. Opções nativas: P = procedimento,
H = médico + anestesista + auxiliares, C = custo operacional, F = filme/materiais.
Não somar novamente essas parcelas ao valor P. H é a referência nativa disponível,
não uma decisão sobre a composição final do orçamento negociado pelo hospital.

A função é executada com a data atual do Oracle, estabelecimento e perfil do vínculo
do usuário; procedimento/origem são revalidados no catálogo ativo vigente para
convênio/categoria. O contexto de usuário é conferido e a conexão é descartada.
O executor usa transação READ ONLY e ROLLBACK ao fim. Não chama a procedure
GERAR_CONSULTA_PRECO que faz limpeza e COMMIT. Se alguma regra exigir escrita na
transação de consulta, a operação falha; não há fallback para permitir gravação.

## Contexto e limites

Esta é uma referência unitária sem médico, plano, acomodação, setor ou tipo de
atendimento específico (parâmetros nulos/zero, conforme assinatura nativa).
Regras particulares desses parâmetros podem alterar o resultado. Materiais e OPME
selecionados são consultados separadamente por `TASY.OBTER_PRECO_MATERIAL`.
Diárias e outros serviços precisam ser selecionados como itens do catálogo:
anotações livres não acrescentam preço. A quantidade atual é **1 por item**.

## Cálculo automático e ajustes

### Confirmação de preço zero

Itens que retornam zero exigem **Confirmar valor zero**, com justificativa de pelo
menos cinco caracteres. Ausência de preço ou composição inconsistente não pode
ser confirmada como zero. A operação `confirmZeroPrice` valida no servidor o item,
a revisão e o acesso ao orçamento, registra ator, NM_USUARIO quando mapeado,
data/hora e justificativa, e preserva a referência anterior. A confirmação vale
somente no portal e não altera o preço no Tasy. Quando não restam pendências, os
totais são liberados. Nova consulta invalida as confirmações para os novos preços,
mas mantém seu histórico. Orçamentos inativos ou com envio iniciado ficam bloqueados.

Com a integração Tasy habilitada, criar um orçamento exige paciente, convênio,
categoria e procedimentos. O backend verifica o acesso à pessoa e o CPF, consulta
os preços e salva uma referência persistente no banco do portal:

- Honorários: soma da opção H dos procedimentos (inclui anestesista e auxiliares).
- Hospitalar: soma de P menos H, mais os materiais/OPME selecionados.
- Total: soma de P e dos materiais/OPME. C e F não são somados novamente.

Os cálculos somam centavos inteiros. Dados financeiros enviados pelo navegador
não substituem a referência. Com todos os preços confirmados, o orçamento fica
concluído no portal, sem aguardar preenchimento manual. Isso não representa uma
aprovação no ERP. Preço total de item zero/nulo, inválido ou composição inconsistente
mantém o orçamento em análise, com subtotal conhecido e total não confirmado.
Honorários zero são aceitos quando o total do procedimento está confirmado.

Nos detalhes, **Ajustar valores** permite negociar honorários e valor hospitalar,
com justificativa obrigatória. O servidor registra valores anteriores/novos,
UUID, nome, vínculo NM_USUARIO quando existente e data/hora. A referência original
é preservada. Uma revisão impede sobrescrever ajustes concorrentes. O médico
continua limitado aos seus orçamentos; Administrador e Comercial usam o escopo
existente. As rotas antigas de preenchimento não podem contornar a auditoria.

Orçamentos anteriores sem valores podem usar **Calcular valores do Tasy**.
Orçamentos com preços pendentes podem consultar novamente; as referências
anteriores são preservadas. Um orçamento já completo/negociado não é recalculado
automaticamente. Inativação, exclusão e envio iniciado ao Tasy bloqueiam ajustes.
O documento para o paciente fica bloqueado enquanto houver preços pendentes.

O envio existente ao Tasy continua sendo um rascunho para cotação: **não grava os
totais negociados como preço final no ERP**. A auditoria financeira desta etapa
fica no banco do portal (`portal.requests.data.precificacao` e `portal.events`).

## Validação real em 21/09/2026

Convênio 29, categoria 1, procedimento 30721075, origem 6, estabelecimento 2:
P = 2865, H = 0, C = 2865, F = 0. Resultado corresponde ao exemplo enviado pela TI.
Materiais: 31 retornou 2,97; OPME 53304 retornou 0 e permanece como preço não
confirmado. A permissão `allPessoaFisica` foi ativada no vínculo existente de
arafaela, conforme solicitação da TI. Não concede acesso anônimo ou novos usuários.

Reinicie o backend (`npm run portal:start` em `services/tasy-api`) para carregar
o código e as permissões atualizadas. Novos vínculos precisam das operações
`pessoas-fisicas.consultar`, `precos.procedimento` e `precos.material`, além dos
catálogos utilizados pelo formulário e do escopo de pessoas adequado.
Crie um orçamento e abra os detalhes para conferir cálculo e auditoria.
As flags de gravação no Tasy não foram alteradas para essa consulta.
