-- Migração de instalação existente; executar uma única vez no ambiente correto.
-- Coordenar com a atualização/reinício da API: o código novo usa o nome AEBMG.
-- Preserva registros, constraints, índices e privilégios da tabela.
ALTER TABLE TASY.PORTAL_ORCAMENTO_ENVIO RENAME TO AEBMG_PORTAL_ORCAMENTO_ENVIO;
