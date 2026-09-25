# E-mail do paciente informado pelo médico

Ao selecionar um paciente existente por CPF ou código, o campo E-mail é
pré-carregado do complemento residencial do Tasy e permanece editável. Selecionar
outro paciente substitui o e-mail anterior; um cadastro sem e-mail deixa o campo
vazio. A correção digitada é enviada ao criar o orçamento, como descrito abaixo.

Na criação de um orçamento de origem médica, o campo E-mail do paciente é enviado
como `email` para a API e salvo em `paciente.email` no portal. Quando o orçamento
possui paciente Tasy selecionado, a API também grava esse endereço em
`TASY.COMPL_PESSOA_FISICA.DS_EMAIL`, no complemento residencial
(`IE_TIPO_COMPLEMENTO=1`) da pessoa física selecionada.

A operação `pessoas-fisicas.atualizar-email` valida o CPF, o escopo do usuário e o
e-mail (até 255 bytes). Atualiza somente o e-mail e a auditoria do complemento
existente; se não houver complemento residencial, insere um novo, mantendo os
demais tipos de complemento. Múltiplos registros residenciais geram conflito.
As triggers permanecem habilitadas e o contexto usa o usuário Tasy da sessão.

A gravação requer `TASY_WRITES_ENABLED=true` e
`TASY_PESSOA_FISICA_DML_ENABLED=true`. Médico e Administrador com permissão de
consulta recebem a operação específica, sem liberar edição geral do cadastro.
O orçamento local só é criado após a confirmação da gravação do e-mail. As bases
Oracle e portal não compartilham transação; uma falha local posterior não desfaz
um e-mail já confirmado no Oracle. Reenviar o mesmo endereço não executa novo DML.

Não há atualização retroativa dos e-mails existentes apenas nas observações de
orçamentos antigos. Nenhum objeto Oracle novo é necessário.

Validação: estrutura, chaves e triggers consultadas no HML; gravações, falhas e
idempotência cobertas por testes automatizados. Não foram alterados contatos reais
para testar a implementação. Reinicie a API para carregar a nova operação.
