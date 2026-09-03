# Budget Navigator

Crie o primeiro protótipo visual de um sistema web interno chamado Portal de Orçamentos de Consultas Particulares.

IMPORTANTE:

Nesta primeira etapa, NÃO implementar banco de dados.

NÃO implementar PostgreSQL.

NÃO implementar autenticação real.

NÃO criar integrações externas.

NÃO criar regras de negócio definitivas.

Usar apenas dados fictícios/mockados para demonstrar a interface.

O objetivo desta etapa é construir principalmente o VISUAL e a EXPERIÊNCIA DE USO.

A arquitetura visual deve ser preparada para posteriormente receber backend, PostgreSQL, autenticação e regras de negócio.

Não assumir que o fluxo atual é definitivo, pois algumas etapas serão ajustadas posteriormente.

Objetivo do sistema

O sistema será um portal interno utilizado por dois perfis principais:

Médico

Comercial

O médico deverá futuramente preencher seus honorários referentes a uma consulta particular.

O setor Comercial deverá futuramente preencher os valores relacionados ao hospital.

O sistema deverá posteriormente permitir que essas informações sejam combinadas para formar o orçamento final.

Por enquanto, queremos apenas representar visualmente esse fluxo.

Estilo visual

Criar uma interface:

Moderna

Profissional

Institucional

Limpa

Minimalista

Responsiva

Com aparência de sistema hospitalar corporativo

Fácil de utilizar

Boa hierarquia visual

Excelente experiência tanto em desktop quanto em celular

Evitar aparência de sistema antigo ou excessivamente burocrático.

Utilizar componentes modernos do shadcn/ui.

Utilizar cards, tabelas, badges, inputs, selects, dialogs, breadcrumbs e outros componentes quando fizer sentido.

Criar bastante espaço em branco e uma hierarquia visual clara.

Identidade visual

Utilizar uma identidade visual inspirada em ambientes hospitalares modernos.

Priorizar tons de azul, branco e tons neutros, com pequenos destaques em verde para situações positivas.

Não exagerar nas cores.

A interface deve transmitir:

Segurança

Organização

Profissionalismo

Confiabilidade

Simplicidade

Estrutura geral

Criar um layout principal com:

Sidebar

No desktop, criar uma sidebar lateral contendo:

Logo/nome do portal

Dashboard

Solicitações

Orçamentos

Médicos

Usuários

Configurações

Na parte inferior da sidebar:

Nome do usuário logado

Perfil

Botão de sair

No mobile, transformar a sidebar em menu lateral/drawer.

Header

Criar um header superior contendo:

Breadcrumb

Título da página

Campo de busca quando fizer sentido

Notificações

Avatar do usuário

Menu do usuário

Tela 1 — Dashboard

Criar uma dashboard inicial com dados fictícios.

Mostrar cards de indicadores:

Solicitações pendentes

Em análise

Aguardando médico

Aguardando Comercial

Orçamentos concluídos

Criar também uma seção de:

Solicitações recentes

Mostrar uma tabela/lista com dados fictícios contendo:

Paciente

Médico

Especialidade

Data da solicitação

Status

Valor

Ação

Utilizar badges para os diferentes status.

Criar também uma seção visual mostrando o fluxo atual das solicitações, por exemplo:

Solicitação → Médico → Comercial → Orçamento

Essa representação deve ser visual e elegante, mas sem considerar esse fluxo como definitivo.

Tela 2 — Solicitações

Criar uma página para listar as solicitações.

Adicionar:

Título "Solicitações"

Botão "Nova solicitação"

Campo de pesquisa

Filtros

Filtro por status

Filtro por médico

Filtro por especialidade

Filtro por período

Criar tabela no desktop e cards/listagem adaptada no mobile.

Cada solicitação deverá apresentar:

Número da solicitação

Paciente

Médico

Especialidade

Data

Status

Valor

Ação "Visualizar"

Utilizar dados fictícios.

Tela 3 — Detalhes da solicitação

Criar uma tela detalhada para uma solicitação fictícia.

Organizar as informações em cards/seções:

Dados do paciente

Nome

CPF

Telefone

E-mail

Data de nascimento

Dados da consulta

Especialidade

Médico

Tipo de consulta

Data desejada

Observações

Honorários médicos

Criar um card visual mostrando:

Status: aguardando preenchimento

Honorários médicos

Observação do médico

Nesta primeira etapa, os campos podem ser demonstrativos.

Valores hospitalares

Criar outro card mostrando:

Valor hospitalar

Observação do Comercial

Resumo financeiro

Criar uma área destacada contendo:

Honorários médicos

Valor hospitalar

Valor total

Usar valores fictícios.

Histórico

Criar uma timeline visual com eventos fictícios:

Solicitação criada

Solicitação enviada ao médico

Honorários preenchidos

Enviada ao Comercial

Valor hospitalar preenchido

Orçamento concluído

Deixar visualmente claro que essa timeline é apenas uma representação inicial e poderá ser alterada posteriormente.

Tela 4 — Área do Médico

Criar uma tela específica para representar a experiência do médico.

Mostrar:

Saudação ao médico

Solicitações aguardando preenchimento

Solicitações já preenchidas

Histórico

Criar cards como:

"3 solicitações aguardando seus honorários"

Abaixo, mostrar uma lista com:

Paciente

Especialidade

Data

Status

Botão "Preencher honorários"

Criar também uma tela/modal visual para o médico preencher:

Honorários médicos

Observações

Por enquanto, os dados não precisam ser persistidos.

Tela 5 — Área Comercial

Criar uma tela específica para o usuário Comercial.

Mostrar:

Solicitações aguardando análise

Solicitações aguardando valores hospitalares

Orçamentos concluídos

Criar uma lista de solicitações.

Ao abrir uma solicitação, mostrar os dados do paciente, consulta e honorários médicos.

Criar uma seção para o Comercial preencher:

Valor hospitalar

Observação

Mostrar também um resumo:

Honorários médicos + Valor hospitalar = Valor total

Por enquanto, apenas visual.

Tela 6 — Médicos

Criar uma página de cadastro/listagem de médicos apenas visual.

Mostrar:

Nome

CRM

Especialidade

Status

Quantidade de solicitações

Adicionar botão "Novo médico".

Criar modal visual de cadastro.

Não implementar persistência ainda.

Tela 7 — Usuários

Criar uma página visual para gerenciamento dos usuários.

Mostrar:

Nome

E-mail

Perfil

Status

Último acesso

Perfis:

Administrador

Comercial

Médico

Adicionar botão "Novo usuário".

Não implementar autenticação real nesta etapa.

Responsividade

A responsividade é obrigatória.

Desktop:

Sidebar fixa

Tabelas

Dashboard em múltiplas colunas

Tablet:

Sidebar adaptada

Cards reorganizados

Celular:

Menu drawer

Cards empilhados

Tabelas transformadas em cards/listas

Botões ocupando largura adequada

Formulários em uma coluna

Nenhum conteúdo deve ficar cortado horizontalmente

Componentes

Criar componentes reutilizáveis para:

StatusBadge

MetricCard

RequestCard

RequestTable

PatientInfoCard

FinancialSummary

Timeline

UserAvatar

PageHeader

EmptyState

SearchAndFilters

Organizar o código de maneira limpa para que posteriormente seja fácil conectar o PostgreSQL.

Dados mockados

Utilizar dados fictícios realistas de:

Pacientes

Médicos

Especialidades

Solicitações

Valores

Status

Não utilizar dados reais.

Navegação

Criar navegação funcional entre as telas utilizando dados mockados.

Os botões e links devem permitir navegar pelo protótipo.

Não é necessário implementar ações persistentes.

Importante sobre a arquitetura

NÃO implementar ainda:

PostgreSQL

Supabase

Login real

Cadastro real

RLS

API

Webhooks

E-mail

WhatsApp

Permissões reais

Persistência de dados

Nesta etapa queremos exclusivamente definir e validar o visual, layout, navegação e experiência do usuário.

O projeto deverá ser estruturado de forma que, nas próximas etapas, possamos conectar PostgreSQL e implementar o fluxo real sem precisar refazer o frontend.

Antes de criar funcionalidades adicionais, priorize a qualidade visual, consistência dos componentes e responsividade.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ortho-wizard-ui.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ae3cc669-5607-4a1f-8491-17517dc35dc0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
