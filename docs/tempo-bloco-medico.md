# Tempo de bloco do médico

Ao selecionar o procedimento principal na nova solicitação do médico, o portal
consulta `medicos.tempo-procedimento` e preenche **Tempo de bloco (minutos)** com
`TASY.TEMPO_PROCED_MEDICO.QT_MEDIA_MEDICO`. O backend resolve o médico pelo
`CD_PESSOA_FISICA` do `NM_USUARIO` vinculado à sessão; o navegador envia apenas o
código do procedimento. A operação é somente leitura.

Durante a consulta, o envio aguarda o resultado, mas o campo permite digitação.
Uma média disponível preenche o campo apenas se ainda não houver valor salvo ou
digitado. Um valor diferente mostra um alerta informativo com a média e o tempo
informado, sem impedir o salvamento nem exigir confirmação. Sem média positiva, sem pessoa vinculada ou em
caso de falha na consulta, o campo permite digitação e explica o motivo. A troca do
procedimento consulta a nova combinação, sem reaproveitar o tempo digitado para
outro procedimento. Tempos já salvos são preservados na revisão de honorários.

O orçamento salva somente o `tempoBloco` informado pelo médico. A média do Tasy
é consultada para o preenchimento inicial e o alerta, sem cópia adicional no
orçamento ou no histórico. Os dados para indicadores serão consultados no Tasy.

A consulta original com `COUNT(*)` verifica divergências em um agendamento; ela
não retorna os minutos e depende de um `NR_SEQUENCIA` que a nova solicitação ainda
não possui. Por isso a integração lê a média diretamente da visão.

Na visão instalada, `NR_PROC_INTERNO` não está exposto. Se houver mais de uma média
distinta para o mesmo médico e procedimento, o portal informa a ambiguidade e
permite digitação. Não escolhe uma linha arbitrária nem recalcula a média de médias.
Para distinguir esses casos automaticamente, será necessário expor o procedimento
interno na visão e vinculá-lo à seleção do portal.

Implementação: `services/tasy-api/src/tempos-medico.mjs` e
`src/lib/data/use-doctor-block-time.ts`. O vínculo ativo dos perfis Médico e
Administrador recebe a permissão de consulta no backend independente. A consulta
não depende da habilitação de gravações no Tasy.

Depois de atualizar o código, reinicie a API no terminal de
`services/tasy-api` com `npm run portal:start` e recarregue o navegador.
