# Aprovação de orçamentos por Custos

Fluxo do backend local do portal:

1. Médico solicita procedimentos, materiais/OPME, quantidades, seu honorário e necessidades (incluindo anestesista). Comercial também pode abrir solicitações para pacientes que o procuram diretamente.
2. O backend calcula as referências Tasy. A solicitação fica **Aguardando Custos**, mesmo quando todos os preços foram encontrados.
3. Em **Orçamentos → Visualizar**, Custos revisa itens e valores. Alterações exigem justificativa e ficam no histórico com antes/depois, usuário do portal, `nm_usuario` e data/hora.
4. **Aprovar e concluir orçamento** libera valores e impressão para médico/Comercial. O orçamento aprovado fica bloqueado para alterações.

## Perfis

- **Médico:** acompanha seus orçamentos; vê o honorário que solicitou, mas não os preços ou totais do orçamento antes da aprovação.
- **Comercial:** abre e acompanha solicitações; não aprova nem altera preços.
- **Custos:** revisa e aprova. Os preços unitários são consultados automaticamente ao selecionar itens.
- **Administrador:** mantém acesso à revisão e aprovação, além da administração de usuários.

Cadastre o usuário de Custos em **Usuários**, selecionando o novo perfil e vinculando seu `nm_usuario`, perfil e estabelecimento Tasy. As permissões de consulta a pacientes continuam sendo configuradas no vínculo individual.

## Valores e auditoria

O honorário solicitado pelo médico é preservado separadamente. O total de honorários aprovado é revisado por Custos: a indicação de anestesista não adiciona automaticamente um preço à equipe. Custos deve avaliar essa composição antes de aprovar.

Referências incompletas impedem a aprovação. Custos pode ajustar o valor unitário de um item com justificativa, incluindo valores zero. Honorários do item desconhecidos ou superiores ao total precisam ser resolvidos antes desse ajuste.

Revisar a seleção recalcula os valores hospitalares com as referências Tasy; ajustes anteriores ficam no histórico. Valores do portal não alteram a tabela de preços do ERP.

As permissões e a ocultação de valores são aplicadas pela API. Antes da aprovação, listagem, detalhes e histórico não retornam referências financeiras a Médico/Comercial; consultas diretas às operações de preço também ficam restritas a Custos/Administrador.

## Atualização e validação

Reinicie a API com Ctrl+C e `npm run portal:start` na pasta `services/tasy-api`. A migração 4 habilita o perfil Custos sem alterar usuários existentes. Atualize a página do portal.

Orçamentos antigos já concluídos permanecem concluídos. O novo fluxo vale para novas solicitações e revisões ainda não concluídas. A integração de envio de rascunhos ao Oracle continua separada da aprovação local; esta alteração não publica valores negociados no ERP.

Valide com contas separadas de Médico, Comercial e Custos: solicitação, preços ocultos, revisão de quantidades e itens, justificativas, aprovação e PDF. Os testes automatizados usam banco isolado e respostas Tasy simuladas.
