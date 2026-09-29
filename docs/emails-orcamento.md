# E-mails do orçamento

A notificação de Custos usa **Orçamento Tasy** no corpo e o número Tasy no assunto. Esse número é `ORCAMENTO_PACIENTE.NR_SEQUENCIA_ORCAMENTO`, retornado pela integração e salvo em `portal.tasy_exports.tasy_id`. A mensagem permanece na fila até a exportação estar confirmada e possuir número; uma exportação pendente ou sem confirmação não dispara a notificação. Mensagens já enviadas não são reenviadas com a mudança. O link continua abrindo o orçamento correspondente no portal.

Ao criar um orçamento, a API grava uma notificação na fila local, na mesma transação da solicitação. O destinatário é `PORTAL_NEW_BUDGET_EMAIL_TO`, inicialmente `amanda.rafaela@he.org.br`. A mensagem contém nome, CPF, nascimento, telefone, e-mail, médico e identificação do orçamento. Não há envio retroativo dos orçamentos anteriores à ativação.

Em **Em aprovação**, o médico responsável ou administrador pode clicar em **Enviar orçamento ao paciente**. A caixa já mostra o e-mail registrado no orçamento e permite alterá-lo somente para esse envio. O PDF anexo usa os itens e o total retornados pelo Tasy; não recalcula preços nem soma novamente os honorários informativos. Antes de enfileirar e de enviar, a API consulta novamente o Tasy. Se a versão ou situação mudar, o envio é bloqueado e deve ser solicitado de novo com os dados atualizados.

## Configuração e ativação

Em `services/tasy-api/.env.portal`:

```dotenv
PORTAL_EMAIL_ENABLED=true
PORTAL_EMAIL_FROM=tasy@aebmg.org.br
PORTAL_EMAIL_TLS_SERVERNAME=webmail.aebmg.org.br
PORTAL_NEW_BUDGET_EMAIL_TO=amanda.rafaela@he.org.br
```

O SMTP é obtido da conexão Oracle configurada para a API, em `TASY.AEBMG_SRV_INFO`, `TIPO_SERV=1`, selecionando exclusivamente a conta cujo `DS_MAIL_ENV` descriptografado corresponde ao remetente. Os campos são descriptografados pela função `AEBMG_DECRYPTING_DATA`, conforme o Python fornecido. Não são copiadas senhas para o frontend ou logs. Usa TLS implícito na porta 465 e STARTTLS obrigatório nas demais portas, com validação do certificado.

Na rede atual, `smtp.aebmg.org.br` e `webmail.aebmg.org.br` resolvem para o mesmo servidor, mas o certificado identifica `webmail.aebmg.org.br`. Por isso `PORTAL_EMAIL_TLS_SERVERNAME` define esse nome para SNI e validação de identidade, mantendo `rejectUnauthorized=true`. Não desative a validação TLS. A conexão e a autenticação foram verificadas sem enviar mensagens. Falhas novas preservam um código seguro de configuração, certificado, autenticação ou conexão no painel.

Instale as dependências com `npm ci` na pasta da API. Reinicie a API no terminal com `npm run portal:start` para carregar a configuração, o código e a migração 8. A migração cria apenas `portal.email_outbox` na base local do portal. Esta funcionalidade não cria objetos no Oracle/Tasy.

## Acompanhamento

O painel do orçamento mostra os envios. A fila é processada após a solicitação e a cada 15 segundos. Uma falha SMTP não desfaz a criação do orçamento. Falhas confirmadas permitem tentativa manual; a notificação interna pode ser repetida pelo administrador. Versões alteradas exigem um novo envio do orçamento atualizado.

O mesmo orçamento, versão e destinatário não é enviado duas vezes por cliques repetidos. Se houver perda da confirmação SMTP ou interrupção durante o envio, o estado fica **sem confirmação**, sem repetição automática. Confira com o destinatário/administrador do correio antes de tentar outro envio. **Aceito pelo servidor** confirma a aceitação SMTP, não a entrega na caixa postal nem a leitura.

Os modelos usam o logotipo existente, azul `#004876` e amarelo `#FFA400` do Manual da Marca. HTML usa Rubik com fallback Arial; o PDF usa Helvetica. O logotipo está embutido, sem download de imagens externas.

Os testes utilizam transporte simulado e dados fictícios, sem enviar e-mails reais.
