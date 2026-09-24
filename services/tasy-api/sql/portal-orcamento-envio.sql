-- Implantação manual pelo DBA em HOMOLOGAÇÃO, após revisão das triggers.
-- Tabela exclusiva de integração; NÃO altera tabelas nativas do Tasy.
-- Mesmo banco/transação do orçamento: a chave impede duplicação após perda da resposta.
CREATE TABLE TASY.AEBMG_PORTAL_ORCAMENTO_ENVIO (
  ID_PORTAL VARCHAR2(36) PRIMARY KEY,
  HASH_CONTEUDO VARCHAR2(64) NOT NULL,
  ID_USUARIO_PORTAL VARCHAR2(36) NOT NULL,
  NM_USUARIO VARCHAR2(15) NOT NULL,
  DT_ENVIO TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  NR_ORCAMENTO NUMBER,
  CONSTRAINT PORTAL_ORC_ENV_ORC_FK FOREIGN KEY (NR_ORCAMENTO)
    REFERENCES TASY.ORCAMENTO_PACIENTE(NR_SEQUENCIA_ORCAMENTO)
);
-- Conceder SELECT/INSERT/UPDATE nesta tabela somente à conta de integração.
-- Não apagar entradas para tentar reenviar: a chave é permanente.
