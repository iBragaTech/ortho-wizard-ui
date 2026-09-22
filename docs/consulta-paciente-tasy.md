# Preencher o orçamento com dados do Tasy

O formulário Novo orçamento oferece busca por CPF ou código Tasy. A consulta
preenche nome, nascimento, CPF e celular e limpa convênio/categoria anteriores
para não associá-los a outro paciente. Esses campos ainda precisam de confirmação
manual. Salvar o orçamento continua gravando somente no banco do portal.

## Habilitar na homologação

1. Confirme host, porta e SERVICE_NAME (ou configuração TNS) do Oracle.
   `tasy_hml_35`, informado pela TI, ainda precisa ser identificado como alias,
   serviço ou nome de conexão salva. Um nome de conexão do SQL Developer não
   configura sozinho a conexão do driver.
2. Preencha `ORACLE_USER`, `ORACLE_PASSWORD` e `ORACLE_CONNECT_STRING` somente
   em `services/tasy-api/.env.portal`. Para SERVICE_NAME, o formato é
   `host:porta/servico`. Use uma conta com SELECT autorizado no cadastro.
3. Configure `TASY_PRINCIPALS_FILE` apontando para o vínculo do usuário local.
   O arquivo `.local/principals.suggested.json` contém o UUID inicial.
   Adicione `pessoas-fisicas.consultar` e `pessoas-fisicas.buscar-cpf` à lista
   `operations` e informe os códigos permitidos em `pessoaFisicaIds`.
   `allPessoaFisica: true` permite consultar todos os pacientes: use apenas
   quando esse escopo estiver autorizado. Nenhuma permissão foi ampliada automaticamente.
4. Configure `TASY_ENABLED=true` e reinicie `npm run portal:start`.
   Mantenha as duas opções de gravação em `false` para validar apenas leitura.

CPF duplicado não escolhe automaticamente um paciente: a API pede consulta
pelo código. Pacientes fora do escopo não são retornados. As permissões de
operação continuam verificadas no backend, além das permissões do Oracle.

## Catálogos ainda pendentes

Convênios e categorias já são consultados no ERP, com situação `A` confirmada
pela TI e categoria filtrada pelo convênio. As operações `catalogos.convenios`
e `catalogos.categorias` exigem permissão no vínculo do usuário. São cadastros
gerais: não representam cobertura do paciente, contrato do estabelecimento ou preço.
O orçamento guarda o código e a descrição selecionados nas observações.

OPME está conectado pela operação `catalogos.opme`: materiais dos grupos 59, 60 e 61,
com material, classe, subgrupo e grupo ativos, conforme SQL fornecido pela TI.
A seleção no novo orçamento permite pesquisa por descrição/código e paginação;
salva código e descrição no texto do orçamento. Não calcula preço nem estoque.
Reinicie a API após adicionar a operação ao vínculo do usuário.

Procedimentos principal e adicionais usam a operação catalogos.procedimentos.
A consulta cruza PROC_INTERNO_CONV, PROC_INTERNO e PROCEDIMENTO e exige convênio
 e categoria ativos. O estabelecimento vem do vínculo do usuário, nunca do navegador.
Considera regras específicas e genéricas (campos nulos), sem restringir previamente
origem, tipo de atendimento ou acomodação. Mantém código e origem na seleção e no
texto salvo no orçamento. A troca do convênio/categoria limpa os procedimentos.

A vigência usa o dia do servidor Oracle (TRUNC(SYSDATE)), com início/fim inclusivos.
Datas nulas representam ausência de limite. Entre regras ativas vigentes do mesmo
contexto, usa a maior data inicial; contextos distintos e empates são preservados.
Não usa uma data máxima global que excluiria procedimentos de outras vigências.
A consulta é paginada em 100 itens e não retorna registros sem vínculo aplicável.

Esse catálogo é uma lista de candidatos por vínculo, não uma reprodução integral
 do motor de faturamento: prioridades de edição AMB/CBHPM, ajustes de preço,
restrições do atendimento e cobertura ainda dependem de homologação própria.
GERAR_CONSULTA_PRECO não é executada: ela grava e faz COMMIT. Nenhum preço é
calculado por essa listagem. As consultas foram executadas em homologação para
cinco pares de convênio/categoria, com retorno paginado em todos eles.
