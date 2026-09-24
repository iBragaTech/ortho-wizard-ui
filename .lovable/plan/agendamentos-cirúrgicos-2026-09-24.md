# Agendamentos Cirúrgicos

## Objetivo
Criar o novo menu **Agendamentos Cirúrgicos** para médicos solicitarem datas de cirurgia e acompanharem somente os próprios pedidos.

## Tela
- Adicionar o item **Agendamentos Cirúrgicos** ao menu para Médico e Administrador.
- Criar uma lista com paciente, CPF, médico solicitante, data desejada, data da solicitação e situação.
- Incluir busca por paciente ou CPF e filtro por situação.
- Adicionar o botão **Novo agendamento**, abrindo um formulário com:
  - Nome do paciente, obrigatório
  - CPF, obrigatório e validado
  - Data desejada, obrigatória e sem permitir datas passadas
- Exibir uma mensagem clara quando ainda não houver agendamentos.

## Acesso e dados
- Médico cria solicitações e visualiza somente as próprias.
- Administrador visualiza todos os agendamentos.
- Comercial e Custos não visualizam nem acessam o menu.
- Salvar os agendamentos no banco atual, mantendo estrutura PostgreSQL simples e portável.
- Aplicar a mesma regra também no servidor, para que o bloqueio não dependa apenas da tela.

## Validação
- Conferir criação e listagem com perfil Médico.
- Conferir visão completa com perfil Administrador.
- Conferir menu oculto e acesso bloqueado para os demais perfis.
- Verificar a tela em desktop e celular.
