-- =============================================================================
-- V3__fecha_ingreso_cliente.sql
-- Objetivo: registrar la FECHA DE INGRESO del cliente, indicada por recepción
-- al darlo de alta (puede ser anterior al registro en el sistema, p. ej. al
-- digitalizar fichas en papel). Es un dato de negocio: `created_at` se
-- mantiene como auditoría técnica y no se edita.
-- =============================================================================

ALTER TABLE clients ADD COLUMN registered_at DATE;

-- Clientes existentes: su fecha de ingreso es el día en que se registraron (hora de Ecuador).
UPDATE clients SET registered_at = (created_at AT TIME ZONE 'America/Guayaquil')::date;

ALTER TABLE clients
  ALTER COLUMN registered_at SET NOT NULL,
  ALTER COLUMN registered_at SET DEFAULT CURRENT_DATE;

CREATE INDEX ix_clients_registered_at ON clients (registered_at DESC);
