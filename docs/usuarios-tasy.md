# Usuários do portal e vínculo individual Tasy

No backend local, o administrador informa no cadastro:

- Nome, e-mail, perfil do **portal** e senha local (12–128 caracteres).
- `NM_USUARIO`, código do perfil **Tasy** e estabelecimento.
- Permissão para consultar pacientes e, separadamente, cadastrar novos pacientes.

Os campos Tasy são obrigatórios para novos usuários. A API verifica usuário e
perfil ativos, vínculo em `USUARIO_PERFIL`, liberação/validade e acesso ao
estabelecimento (`USUARIO_ESTABELECIMENTO.NM_USUARIO_PARAM`, ou estabelecimento
do usuário). A mesma validação é feita ao resolver a identidade para uma operação
Tasy. Não há leitura de senhas/hashes do ERP.

## Persistência e auditoria

A migração 3 cria `portal.tasy_user_links` e `portal.tasy_user_link_events`.
O vínculo é associado ao UUID da conta e contém o NM_USUARIO utilizado na
integração. Cada NM_USUARIO pode pertencer a apenas uma conta do portal.
A criação/alteração registra o administrador, a data/hora e os valores anteriores
e novos. Não contém senhas.

Os vínculos existentes do arquivo `TASY_PRINCIPALS_FILE` são importados uma vez,
preservando permissões. Depois disso o banco do portal é a fonte do vínculo:
editar o arquivo não sobrescreve alterações feitas na tela. O botão **Vínculo
Tasy** permite configurar usuários existentes, sem reiniciar a API. A autorização
é resolvida novamente em cada operação; os orçamentos preservam a auditoria
histórica com o vínculo utilizado na ocasião.

Novos vínculos recebem somente as operações do portal necessárias aos catálogos,
preços e consulta de pessoas. A permissão de cadastrar pacientes é explícita e
continua sujeita às flags de gravação do servidor. O cadastro não concede atualização
de pacientes existentes nem envio de orçamento ao Tasy. O perfil Administrador do
portal não concede privilégios administrativos no ERP.

## Senhas

A autenticação permanece local, com scrypt e sessão do portal. NM_USUARIO identifica
o responsável; não valida a senha do Tasy. Não existe no projeto uma integração
homologada com a autenticação própria do ERP. Para usar essa senha, a TI/fornecedor
precisa disponibilizar uma API ou rotina de autenticação suportada, incluindo o
tratamento de conta bloqueada, senha vencida e tentativas inválidas. Não é feita
cópia, comparação ou sincronização de hashes do Tasy.
