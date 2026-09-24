# Fluxo alvo: orçamento para pacientes externos

Requisito confirmado pela TI: médicos e Comercial trabalham pelo portal, sem
precisar acessar a interface do Tasy. O Tasy fornece os cadastros e os valores
de referência; o banco do portal mantém o orçamento e seu fluxo de trabalho.
Destino final confirmado pela TI: o orçamento também deve ser inserido no Tasy,
com rastreabilidade por data/hora e NM_USUARIO para relatórios futuros.

## Envio ao Tasy e rastreabilidade

O envio para **aguardando cotação** ocorre automaticamente na criação da solicitação
e está habilitado e validado em TASYHML. Veja [escopo, ativação e validação](envio-orcamento-tasy.md).
Revisões posteriores e fechamento do orçamento no Tasy não são sincronizados por este fluxo.

Requisitos do fluxo completo:

- Guardar a relação entre o UUID do orçamento local e NR_SEQUENCIA_ORCAMENTO
  retornado pelo Tasy; preservar os identificadores dos itens enviados.
- Usar o vínculo de identidade mantido no servidor para NM_USUARIO. Nunca aceitar
  do navegador o nome de outro usuário Tasy. Guardar também UUID do usuário do
  portal, perfil e ação para distinguir os responsáveis mesmo quando uma conta
  técnica for usada na integração.
- Registrar eventos persistentes: data/hora gerada no servidor, responsável,
  orçamento local/Tasy, ação, identificador da tentativa, resultado e alterações
  de valores com referência original e justificativa. Não registrar credenciais.
- Distinguir rascunho, envio pendente, confirmação, falha e resultado desconhecido.
  Só informar sincronização concluída quando o Tasy confirmar a gravação.
- Uma nova tentativa não deve duplicar orçamento nem paciente. Persistir uma
  chave de envio estável e um mecanismo de reconciliação no Oracle; uma marcação
  apenas no banco do portal não resolve a perda da resposta após COMMIT.
- Definir quais alterações após o envio serão sincronizadas, mantendo histórico
  e controle de concorrência. Não usar apenas NM_USUARIO/DT_ATUALIZACAO do registro
  como histórico completo, pois representam o estado mais recente.

Diagnóstico de homologação em 21/09/2026 (somente leitura): ORCAMENTO_PACIENTE e
ORCAMENTO_PACIENTE_PROC possuem NM_USUARIO e DT_ATUALIZACAO. Existem triggers de
histórico habilitadas: ORCAMENTO_PACIENTE_HIST_TRG (UPDATE) e
ORCAMENTO_PACIENTE_PROC_HIST_TRG (INSERT/UPDATE/DELETE). É necessário validar o
conteúdo e destino desses históricos antes de aproveitá-los nos relatórios.
INSERT_ORCAMENTO_PAC_PROC lê PROCEDIMENTO_GUIA_WINT; não é uma rotina genérica
que recebe a lista de itens do portal. Sua utilização não foi presumida.

## Paciente

1. Consultar CPF no backend e reutilizar a pessoa existente.
2. Distinguir ausência real de cadastro, falta de permissão, CPF duplicado e
   indisponibilidade. Apenas ausência real permite seguir para inclusão.
3. Incluir nome, nascimento e CPF obrigatórios e obter CD_PESSOA_FISICA pelo
   mecanismo de código já identificado no Tasy; guardar esse código no orçamento.
4. Não atualizar automaticamente a pessoa existente ao salvar o orçamento.
5. Se o Tasy confirmar a inclusão e a gravação local falhar, reutilizar o cadastro
   confirmado na próxima tentativa. Uma falha de resposta não autoriza repetir INSERT.

Situação atual: leitura real homologada com escopo limitado ao paciente de teste.
A operação de inclusão existe, mas a gravação real permanece desabilitada e não
foi validada com as triggers do hospital. A consulta prévia de CPF isolada não
garante ausência de duplicidade em inclusões simultâneas. A liberação requer
definir o escopo de consulta dos usuários e validar o mecanismo de concorrência.

## Seleções

- Convênio e categoria: selecionar os cadastros ativos do Tasy. Não atribuir
  automaticamente o último convênio de um atendimento ao novo orçamento.
- Procedimentos principal e adicionais: cadastros ativos com vínculos aplicáveis
  ao convênio, categoria e estabelecimento, usando a última vigência válida hoje.
- OPME: grupos 59, 60 e 61 com material, classe, subgrupo e grupo ativos.
- O backend deve validar os códigos novamente ao fechar o orçamento; não confiar
  em descrição ou preço enviados pelo navegador.

Situação atual: seletores consultam o ERP, mas os códigos/descrições são gravados
principalmente em textos. Falta persistir os identificadores em campos próprios
e validar integralmente as seleções no backend do orçamento. A listagem de
procedimentos por vínculo não substitui regras de cobertura e faturamento.

## Valores

Honorários e valores hospitalares precisam vir de uma cotação identificada,
calculada no backend com as regras do Tasy. Não considerar ausência de preço como
zero e não aceitar um valor digitado como se tivesse sido retornado pelo ERP.

Guardar os itens, parâmetros utilizados, data da cotação, vigência, parcelas,
identificação do cálculo e usuário responsável junto ao orçamento. A mudança de
convênio, categoria, itens ou contexto de cálculo invalida a cotação anterior.

GERAR_CONSULTA_PRECO recebe um item e vários parâmetros; faz DELETE/INSERT em
W_CONSULTA_PRECO e COMMIT. Precisa de operação própria e tratamento de concorrência
e identificação do resultado. Não deve ser exposta como consulta SQL livre nem
executada na rota somente de leitura dos catálogos.

Situação atual: os valores do portal ainda são manuais. Falta integrar e homologar
o cálculo. A composição dos totais deve ser confirmada com o hospital: não assumir
que VL_PROCEDIMENTO seja valor hospitalar líquido nem somá-lo indiscriminadamente
às parcelas VL_MEDICO, VL_ANESTESISTA, VL_AUXILIARES ou VL_MATERIAIS.

Negociação confirmada pela TI: valores do Tasy são referências, com ajustes
registrados. A implementação deverá preservar a referência original e registrar
valor anterior, novo valor, responsável, data e justificativa de cada alteração.
O valor negociado não deve sobrescrever a referência nem alterar a tabela de
preços do Tasy. Esse histórico de negociação ainda precisa ser implementado.

Pendências de definição: composição de honorários/valor hospitalar e parâmetros
de cálculo exigidos em cada contexto. A resposta "sim" não especifica as parcelas
de cada total; nenhuma fórmula foi assumida a partir dela ou do nome dos campos.
