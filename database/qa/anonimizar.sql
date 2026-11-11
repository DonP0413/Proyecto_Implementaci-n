-- =============================================================================
-- database/qa/anonimizar.sql
-- Objetivo: convertir una COPIA de la base de producción/desarrollo en datos
-- aptos para QA (LOPDP Ecuador, riesgo R-14): se conservan órdenes, estados,
-- cotizaciones, características e historial, pero se reemplazan los datos
-- personales por valores ficticios y coherentes.
--
-- ⚠ Ejecutar SOLO sobre la base temporal que crea scripts/export-qa.sh.
--   Nunca sobre la base real: los cambios no se pueden deshacer.
--
-- Parámetro: la sesión debe definir `qa.password` (contraseña común de los
-- usuarios de QA) antes de ejecutar este archivo.
-- =============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- Salvaguarda: nunca anonimizar una base cuyo nombre no indique que es temporal de QA.
DO $$
BEGIN
  IF current_database() NOT LIKE '%qa%' THEN
    RAISE EXCEPTION 'anonimizar.sql sólo se ejecuta sobre la base temporal de QA (actual: %)', current_database();
  END IF;
  IF coalesce(current_setting('qa.password', true), '') = '' THEN
    RAISE EXCEPTION 'Falta definir qa.password';
  END IF;
END $$;

-- pgcrypto sólo para generar el hash bcrypt de la contraseña de QA; se elimina al final.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Mapa "valor real -> valor ficticio" de todo dato personal identificable.
CREATE TEMP TABLE qa_map (old_value text PRIMARY KEY, new_value text NOT NULL);

WITH c AS (
  SELECT c.*, row_number() OVER (ORDER BY created_at, id) AS n FROM clients c
)
INSERT INTO qa_map
SELECT v.old_value, v.new_value
FROM c,
LATERAL (VALUES
  (c.full_name,   'Cliente QA ' || lpad(c.n::text, 3, '0')),
  (c.email,       'cliente' || lpad(c.n::text, 3, '0') || '@qa.pintotech.test'),
  (c.document_id, '17' || lpad(c.n::text, 8, '0')),
  (c.phone,       '09' || lpad(c.n::text, 8, '0')),
  (c.address,     'Dirección de prueba ' || c.n)
) AS v(old_value, new_value)
WHERE v.old_value IS NOT NULL AND length(v.old_value) >= 4
ON CONFLICT (old_value) DO NOTHING;

WITH u AS (
  SELECT u.*, row_number() OVER (PARTITION BY role ORDER BY created_at, id) AS n FROM users u
)
INSERT INTO qa_map
SELECT v.old_value, v.new_value
FROM u,
LATERAL (VALUES
  (u.full_name, 'Usuario QA ' || initcap(lower(u.role)) || ' ' || u.n),
  (u.email,     lower(u.role) || u.n || '@qa.pintotech.test')
) AS v(old_value, new_value)
WHERE length(v.old_value) >= 4
ON CONFLICT (old_value) DO NOTHING;

-- Quien retiró el equipo (si no es el propio cliente, ya mapeado arriba).
WITH d AS (
  SELECT d.*, row_number() OVER (ORDER BY delivered_at, work_order_id) AS n FROM delivery_records d
)
INSERT INTO qa_map
SELECT v.old_value, v.new_value
FROM d,
LATERAL (VALUES
  (d.received_by_name,     'Persona que retira ' || d.n),
  (d.received_by_document, '18' || lpad(d.n::text, 8, '0'))
) AS v(old_value, new_value)
WHERE v.old_value IS NOT NULL AND length(v.old_value) >= 4
ON CONFLICT (old_value) DO NOTHING;

-- Identificadores del equipo: número de serie e IMEI.
WITH e AS (
  SELECT e.*, row_number() OVER (ORDER BY created_at, id) AS n FROM equipments e
)
INSERT INTO qa_map
SELECT v.old_value, v.new_value
FROM e,
LATERAL (VALUES
  (e.serial_number,               'SERIE-QA-' || lpad(e.n::text, 4, '0')),
  (e.technical_specs ->> 'imei',  '35' || lpad(e.n::text, 13, '0'))
) AS v(old_value, new_value)
WHERE v.old_value IS NOT NULL AND length(v.old_value) >= 4
ON CONFLICT (old_value) DO NOTHING;

-- 2) Reemplazo en TODO texto libre y JSON (el nombre o correo pueden estar
--    copiados en notas, cotizaciones, bitácoras o en el payload de los correos).
--    Primero los valores más largos, para no reemplazar fragmentos.
CREATE TEMP TABLE qa_map_sorted AS SELECT * FROM qa_map ORDER BY length(old_value) DESC;

CREATE FUNCTION pg_temp.qa_scrub(value text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  m record;
BEGIN
  IF value IS NULL THEN RETURN NULL; END IF;
  FOR m IN SELECT old_value, new_value FROM qa_map_sorted LOOP
    value := replace(value, m.old_value, m.new_value);
  END LOOP;
  RETURN value;
END $$;

UPDATE work_orders SET reported_issue = pg_temp.qa_scrub(reported_issue),
                       specs_snapshot = pg_temp.qa_scrub(specs_snapshot::text)::jsonb;
UPDATE equipments SET technical_specs = pg_temp.qa_scrub(technical_specs::text)::jsonb,
                      serial_number = pg_temp.qa_scrub(serial_number);
UPDATE reception_conditions SET visible_damage = pg_temp.qa_scrub(visible_damage),
                                functional_notes = pg_temp.qa_scrub(functional_notes);
UPDATE work_order_accessories SET notes = pg_temp.qa_scrub(notes);
UPDATE quotations SET description = pg_temp.qa_scrub(description);
UPDATE status_history SET note = pg_temp.qa_scrub(note);
UPDATE technical_logs SET diagnosis = pg_temp.qa_scrub(diagnosis),
                          procedures = pg_temp.qa_scrub(procedures),
                          configurations = pg_temp.qa_scrub(configurations),
                          spare_parts = pg_temp.qa_scrub(spare_parts),
                          observations = pg_temp.qa_scrub(observations);
UPDATE delivery_records SET work_summary = pg_temp.qa_scrub(work_summary),
                            return_condition = pg_temp.qa_scrub(return_condition),
                            accessories_notes = pg_temp.qa_scrub(accessories_notes),
                            received_by_name = pg_temp.qa_scrub(received_by_name),
                            received_by_document = pg_temp.qa_scrub(received_by_document);
UPDATE notifications SET recipient_email = pg_temp.qa_scrub(recipient_email),
                         subject = pg_temp.qa_scrub(subject),
                         payload = pg_temp.qa_scrub(payload::text)::jsonb,
                         last_error = pg_temp.qa_scrub(last_error),
                         provider_message_id = NULL;
UPDATE attachments SET original_name = pg_temp.qa_scrub(original_name);

-- 3) Tablas maestras con los valores ficticios.
UPDATE clients SET full_name = pg_temp.qa_scrub(full_name),
                   email = pg_temp.qa_scrub(email),
                   document_id = pg_temp.qa_scrub(document_id),
                   phone = pg_temp.qa_scrub(phone),
                   address = pg_temp.qa_scrub(address);

-- Usuarios del personal: nombres y correos ficticios y UNA contraseña común de QA
-- (nunca se entregan los hashes reales). bcrypt compatible con el backend (bcryptjs).
UPDATE users SET full_name = pg_temp.qa_scrub(full_name),
                 email = pg_temp.qa_scrub(email),
                 password_hash = crypt(current_setting('qa.password'), gen_salt('bf', 10));

-- 4) Comprobantes PDF ya generados: llevan los datos reales impresos y no se
--    pueden anonimizar, así que no viajan a QA (los nuevos ingresos de QA
--    generan los suyos).
DELETE FROM attachments WHERE category = 'RECEIPT_PDF';

DROP EXTENSION IF EXISTS pgcrypto;

-- 5) Control: no debe quedar ningún valor real en las columnas principales.
DO $$
DECLARE
  leftovers int;
BEGIN
  SELECT count(*) INTO leftovers FROM qa_map m
  WHERE EXISTS (SELECT 1 FROM clients c WHERE m.old_value IN (c.full_name, c.email, c.document_id, c.phone, c.address))
     OR EXISTS (SELECT 1 FROM users u WHERE m.old_value IN (u.full_name, u.email))
     OR EXISTS (SELECT 1 FROM notifications n WHERE n.payload::text LIKE '%' || m.old_value || '%' OR n.recipient_email = m.old_value);
  IF leftovers > 0 THEN
    RAISE EXCEPTION 'La anonimización dejó % valores reales sin reemplazar', leftovers;
  END IF;
END $$;

COMMIT;
