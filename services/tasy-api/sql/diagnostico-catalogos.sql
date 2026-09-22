-- Execute no Oracle de homologação. Retorna somente metadados, sem pacientes.
-- Nomes abaixo são candidatos: validar os objetos e regras usados pelo hospital.
SELECT owner, table_name, column_name, data_type, data_length, nullable
FROM all_tab_columns
WHERE owner = 'TASY'
  AND (table_name IN ('CONVENIO', 'CATEGORIA_CONVENIO', 'PROCEDIMENTO',
                     'PROCEDIMENTO_ESTABELECIMENTO', 'MATERIAL')
       OR (table_name = 'PESSOA_FISICA' AND
           (column_name LIKE '%TELEF%' OR column_name LIKE '%CELULAR%' OR column_name LIKE '%DDD%')))
ORDER BY table_name, column_id;

-- Chaves e relacionamentos disponíveis para validar vínculos entre catálogos.
SELECT c.table_name, c.constraint_name, c.constraint_type, cc.column_name,
       c.r_owner, c.r_constraint_name
FROM all_constraints c
JOIN all_cons_columns cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
WHERE c.owner = 'TASY'
  AND c.table_name IN ('CONVENIO', 'CATEGORIA_CONVENIO', 'PROCEDIMENTO',
                      'PROCEDIMENTO_ESTABELECIMENTO', 'MATERIAL')
  AND c.constraint_type IN ('P', 'R', 'U')
ORDER BY c.table_name, c.constraint_name, cc.position;
