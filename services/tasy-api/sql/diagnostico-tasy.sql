-- Executar no SQL Developer com uma conta que possa consultar o dicionario.
-- Somente leitura: nao executa NEXTVAL, DDL ou DML.

-- 1. Versao (BANNER funciona tambem nas versoes anteriores ao Oracle 18c).
SELECT banner FROM v$version WHERE banner LIKE 'Oracle%';

-- 2. Localizar o owner real da tabela. Pode haver mais de um ambiente/schema.
SELECT owner, table_name
FROM all_tables
WHERE table_name = 'PESSOA_FISICA'
ORDER BY owner;

-- 3. Tipos, limites, obrigatoriedade e defaults. Informar o owner do passo 2.
-- Nao limitar aos quatro campos: outros campos NOT NULL podem exigir valores.
SELECT owner, column_name, data_type, data_length, char_length,
       char_used, data_precision, data_scale, nullable, data_default
FROM all_tab_columns
WHERE owner = UPPER(:owner_tasy)
  AND table_name = 'PESSOA_FISICA'
ORDER BY column_id;

-- 4. Triggers: localizar a atribuicao a :NEW.CD_PESSOA_FISICA no corpo.
SELECT owner, trigger_name, status, triggering_event, trigger_body
FROM all_triggers
WHERE table_owner = UPPER(:owner_tasy)
  AND table_name = 'PESSOA_FISICA'
ORDER BY owner, trigger_name;

-- 5. Sequences usadas diretamente nas triggers (candidatas, nao confirmacao).
SELECT DISTINCT t.table_owner, t.trigger_name,
       d.referenced_owner AS sequence_owner,
       d.referenced_name AS sequence_name
FROM all_triggers t
JOIN all_dependencies d ON d.owner = t.owner
                      AND d.name = t.trigger_name
                      AND d.type = 'TRIGGER'
WHERE t.table_owner = UPPER(:owner_tasy)
  AND t.table_name = 'PESSOA_FISICA'
  AND d.referenced_type = 'SEQUENCE'
ORDER BY t.trigger_name, d.referenced_name;

-- 6. Dependencias das triggers: uma delas pode chamar uma procedure/package
-- que gera o identificador. Inspecionar essa rotina se o passo 5 vier vazio.
SELECT t.trigger_name, d.referenced_owner, d.referenced_name, d.referenced_type
FROM all_triggers t
JOIN all_dependencies d ON d.owner = t.owner
                      AND d.name = t.trigger_name
                      AND d.type = 'TRIGGER'
WHERE t.table_owner = UPPER(:owner_tasy)
  AND t.table_name = 'PESSOA_FISICA'
ORDER BY t.trigger_name, d.referenced_type, d.referenced_name;

-- 7. Chaves e colunas: conferir unicidade do codigo/CPF e constraints ativas.
SELECT c.owner, c.constraint_name, c.constraint_type, c.status, c.validated,
       cc.column_name, cc.position
FROM all_constraints c
JOIN all_cons_columns cc ON cc.owner = c.owner
                       AND cc.constraint_name = c.constraint_name
                       AND cc.table_name = c.table_name
WHERE c.owner = UPPER(:owner_tasy)
  AND c.table_name = 'PESSOA_FISICA'
  AND c.constraint_type IN ('P', 'U')
ORDER BY c.constraint_name, cc.position;

-- 8. Indices unicos tambem podem garantir unicidade sem constraint declarada.
SELECT i.owner, i.index_name, i.uniqueness, i.status,
       ic.column_name, ic.column_position
FROM all_indexes i
JOIN all_ind_columns ic ON ic.index_owner = i.owner
                      AND ic.index_name = i.index_name
WHERE i.table_owner = UPPER(:owner_tasy)
  AND i.table_name = 'PESSOA_FISICA'
  AND i.uniqueness = 'UNIQUE'
ORDER BY i.index_name, ic.column_position;

-- Resultado vazio nas views ALL_* pode indicar falta de visibilidade/permissao.
-- Se a coluna usar identity (Oracle 12c+), consultar ALL_TAB_IDENTITY_COLS
-- separadamente, depois de confirmar a versao. Nao escolher uma sequence
-- apenas pelo nome e nao executar NEXTVAL apenas para descobrir qual e.

-- 9. Assinaturas das rotinas de contexto (somente metadados, nao as executa).
SELECT package_name, object_name, overload, argument_name, position,
       data_type, in_out, defaulted
FROM all_arguments
WHERE owner = 'TASY'
  AND package_name = 'WHEB_USUARIO_PCK'
  AND object_name IN ('SET_NM_USUARIO', 'SET_CD_ESTABELECIMENTO',
                      'SET_CD_PERFIL', 'SET_IE_EXECUTAR_TRIGGER')
ORDER BY object_name, overload, sequence;
