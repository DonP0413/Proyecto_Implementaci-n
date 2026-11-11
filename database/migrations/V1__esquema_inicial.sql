-- =============================================================================
-- V1__esquema_inicial.sql
-- Objetivo: crear el esquema relacional completo de PINTOTECH (gestión y
-- seguimiento de reparación de equipos electrónicos).
-- Motor: PostgreSQL 16+
-- Convenciones:
--   * snake_case, tablas en plural.
--   * PK UUID (gen_random_uuid, nativo desde PG13) para no exponer conteos y
--     permitir generar IDs sin coordinación. status_history usa BIGSERIAL por
--     ser una tabla de alto volumen, append-only y nunca expuesta por ID.
--   * Estados como VARCHAR + CHECK (no ENUM nativo) para poder agregar estados
--     con un simple ALTER ... CHECK dentro de una transacción.
--   * TIMESTAMPTZ siempre (la tienda opera en America/Guayaquil, pero se
--     almacena en UTC).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- búsquedas parciales (ILIKE '%x%') indexadas

-- -----------------------------------------------------------------------------
-- Función genérica para mantener updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- USERS: personal de la tienda (administrador, recepcionista, técnico)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(20)  NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_users_role CHECK (role IN ('ADMIN', 'RECEPCIONISTA', 'TECNICO')),
  CONSTRAINT ck_users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- CLIENTS: dueños de los equipos
-- -----------------------------------------------------------------------------
CREATE TABLE clients (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    VARCHAR(150) NOT NULL,
  document_id  VARCHAR(20),                 -- cédula / RUC / pasaporte (opcional)
  email        VARCHAR(160) NOT NULL,       -- obligatorio: canal de notificación
  phone        VARCHAR(20),
  address      VARCHAR(250),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_clients_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT ck_clients_full_name_not_blank CHECK (length(trim(full_name)) > 0)
);
CREATE UNIQUE INDEX ux_clients_document_id ON clients (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX ix_clients_email_lower ON clients (lower(email));
CREATE INDEX ix_clients_full_name_trgm ON clients USING gin (full_name gin_trgm_ops);
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- EQUIPMENT_TYPES: catálogo (laptop, impresora 3D, tarjeta madre, ...)
-- spec_schema define los campos técnicos que el frontend debe pedir.
-- -----------------------------------------------------------------------------
CREATE TABLE equipment_types (
  id           SMALLSERIAL  PRIMARY KEY,
  code         VARCHAR(30)  NOT NULL UNIQUE,
  name         VARCHAR(80)  NOT NULL,
  spec_schema  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_equipment_types_spec_schema_array CHECK (jsonb_typeof(spec_schema) = 'array')
);

-- -----------------------------------------------------------------------------
-- EQUIPMENTS: equipo físico de un cliente. Se reutiliza entre órdenes para
-- mantener el historial de reparaciones por número de serie.
-- -----------------------------------------------------------------------------
CREATE TABLE equipments (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID         NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  equipment_type_id  SMALLINT     NOT NULL REFERENCES equipment_types(id) ON DELETE RESTRICT,
  brand              VARCHAR(60)  NOT NULL,
  model              VARCHAR(80)  NOT NULL,
  serial_number      VARCHAR(80),             -- algunos equipos genéricos no tienen serie
  technical_specs    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_equipments_specs_object CHECK (jsonb_typeof(technical_specs) = 'object')
);
CREATE INDEX ix_equipments_client_id ON equipments (client_id);
CREATE INDEX ix_equipments_serial_lower ON equipments (lower(serial_number)) WHERE serial_number IS NOT NULL;
CREATE INDEX ix_equipments_serial_trgm ON equipments USING gin (serial_number gin_trgm_ops);
CREATE TRIGGER trg_equipments_updated_at BEFORE UPDATE ON equipments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- WORK_ORDERS: orden de trabajo (ID único de trabajo = code)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE work_order_code_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE work_orders (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     VARCHAR(20)  NOT NULL,
  client_id                UUID         NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  equipment_id             UUID         NOT NULL REFERENCES equipments(id) ON DELETE RESTRICT,
  status                   VARCHAR(30)  NOT NULL DEFAULT 'INGRESADO',
  reported_issue           TEXT         NOT NULL,
  specs_snapshot           JSONB        NOT NULL DEFAULT '{}'::jsonb, -- specs al momento del ingreso
  received_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  received_by              UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_technician_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  estimated_delivery_date  DATE,
  delivered_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ux_work_orders_code UNIQUE (code),
  CONSTRAINT ck_work_orders_status CHECK (status IN (
    'INGRESADO', 'EN_REVISION', 'COTIZACION_GENERADA',
    'EN_REPARACION', 'LISTO_PARA_RETIRAR', 'ENTREGADO')),
  CONSTRAINT ck_work_orders_delivered_consistency CHECK (
    (status = 'ENTREGADO' AND delivered_at IS NOT NULL) OR
    (status <> 'ENTREGADO' AND delivered_at IS NULL))
);
CREATE INDEX ix_work_orders_status_received ON work_orders (status, received_at DESC);
CREATE INDEX ix_work_orders_received_at ON work_orders (received_at DESC);
CREATE INDEX ix_work_orders_client_id ON work_orders (client_id);
CREATE INDEX ix_work_orders_equipment_id ON work_orders (equipment_id);
CREATE INDEX ix_work_orders_technician ON work_orders (assigned_technician_id) WHERE assigned_technician_id IS NOT NULL;
CREATE INDEX ix_work_orders_code_trgm ON work_orders USING gin (code gin_trgm_ops);
CREATE TRIGGER trg_work_orders_updated_at BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- RECEPTION_CONDITIONS (1:1): estado físico y funcional al recibir
-- -----------------------------------------------------------------------------
CREATE TABLE reception_conditions (
  work_order_id       UUID         PRIMARY KEY REFERENCES work_orders(id) ON DELETE CASCADE,
  power_status        VARCHAR(12)  NOT NULL,
  physical_condition  VARCHAR(10)  NOT NULL,
  visible_damage      TEXT,
  functional_notes    TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_reception_power_status CHECK (power_status IN ('SI', 'NO', 'NO_PROBADO')),
  CONSTRAINT ck_reception_physical_condition CHECK (physical_condition IN ('BUENO', 'REGULAR', 'MALO'))
);

-- -----------------------------------------------------------------------------
-- WORK_ORDER_ACCESSORIES (1:N): accesorios recibidos / devueltos
-- -----------------------------------------------------------------------------
CREATE TABLE work_order_accessories (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  UUID         NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name           VARCHAR(80)  NOT NULL,
  quantity       SMALLINT     NOT NULL DEFAULT 1,
  notes          VARCHAR(200),
  returned       BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_accessories_quantity CHECK (quantity > 0)
);
CREATE INDEX ix_accessories_work_order ON work_order_accessories (work_order_id);

-- -----------------------------------------------------------------------------
-- QUOTATIONS (1:N): cotizaciones (puede haber re-cotización)
-- -----------------------------------------------------------------------------
CREATE TABLE quotations (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID           NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  amount          NUMERIC(10, 2) NOT NULL,
  description     TEXT           NOT NULL,
  estimated_days  SMALLINT,
  created_by      UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  notified_at     TIMESTAMPTZ,
  CONSTRAINT ck_quotations_amount CHECK (amount >= 0),
  CONSTRAINT ck_quotations_days CHECK (estimated_days IS NULL OR estimated_days > 0)
);
CREATE INDEX ix_quotations_work_order ON quotations (work_order_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TECHNICAL_LOGS (1:N): registro interno del técnico (NUNCA visible al cliente)
-- -----------------------------------------------------------------------------
CREATE TABLE technical_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID         NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  author_id       UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  diagnosis       TEXT,
  procedures      TEXT,
  configurations  TEXT,
  spare_parts     TEXT,
  observations    TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_technical_logs_not_empty CHECK (
    COALESCE(diagnosis, procedures, configurations, spare_parts, observations) IS NOT NULL)
);
CREATE INDEX ix_technical_logs_work_order ON technical_logs (work_order_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- DELIVERY_RECORDS (1:1): información visible para el cliente en la entrega
-- -----------------------------------------------------------------------------
CREATE TABLE delivery_records (
  work_order_id         UUID           PRIMARY KEY REFERENCES work_orders(id) ON DELETE CASCADE,
  work_summary          TEXT           NOT NULL,
  amount_charged        NUMERIC(10, 2) NOT NULL,
  return_condition      TEXT           NOT NULL,
  accessories_notes     VARCHAR(500),
  received_by_name      VARCHAR(150)   NOT NULL,
  received_by_document  VARCHAR(20),
  delivered_by          UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  delivered_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT ck_delivery_amount CHECK (amount_charged >= 0)
);

-- -----------------------------------------------------------------------------
-- ATTACHMENTS (1:N): fotografías y documentos. visibility separa lo visible
-- al cliente de lo interno; la regla se refuerza a nivel de BD.
-- -----------------------------------------------------------------------------
CREATE TABLE attachments (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     UUID          NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  technical_log_id  UUID          REFERENCES technical_logs(id) ON DELETE SET NULL,
  category          VARCHAR(30)   NOT NULL,
  visibility        VARCHAR(10)   NOT NULL,
  original_name     VARCHAR(255)  NOT NULL,
  storage_key       VARCHAR(300)  NOT NULL,
  mime_type         VARCHAR(100)  NOT NULL,
  size_bytes        INTEGER       NOT NULL,
  uploaded_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ux_attachments_storage_key UNIQUE (storage_key),
  CONSTRAINT ck_attachments_category CHECK (category IN (
    'RECEPTION_PHOTO', 'DELIVERY_PHOTO', 'TECHNICAL_DOCUMENT', 'RECEIPT_PDF')),
  CONSTRAINT ck_attachments_visibility CHECK (visibility IN ('CLIENT', 'INTERNAL')),
  CONSTRAINT ck_attachments_technical_internal CHECK (
    category <> 'TECHNICAL_DOCUMENT' OR visibility = 'INTERNAL'),
  CONSTRAINT ck_attachments_size CHECK (size_bytes > 0)
);
CREATE INDEX ix_attachments_work_order ON attachments (work_order_id, category);

-- -----------------------------------------------------------------------------
-- STATUS_HISTORY (1:N): trazabilidad de cada cambio de estado (auditoría)
-- -----------------------------------------------------------------------------
CREATE TABLE status_history (
  id             BIGSERIAL    PRIMARY KEY,
  work_order_id  UUID         NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  from_status    VARCHAR(30),
  to_status      VARCHAR(30)  NOT NULL,
  note           VARCHAR(500),
  changed_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  changed_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_status_history_work_order ON status_history (work_order_id, changed_at);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS: patrón Transactional Outbox. Se inserta en la misma
-- transacción que el cambio de negocio y un worker la envía por Mailgun
-- con reintentos y backoff exponencial.
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id        UUID          NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  type                 VARCHAR(30)   NOT NULL,
  trigger              VARCHAR(10)   NOT NULL,
  template             VARCHAR(50)   NOT NULL,
  recipient_email      VARCHAR(160)  NOT NULL,
  subject              VARCHAR(200)  NOT NULL,
  payload              JSONB         NOT NULL DEFAULT '{}'::jsonb,
  status               VARCHAR(10)   NOT NULL DEFAULT 'PENDING',
  attempts             SMALLINT      NOT NULL DEFAULT 0,
  max_attempts         SMALLINT      NOT NULL DEFAULT 5,
  next_attempt_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  last_error           TEXT,
  provider_message_id  VARCHAR(200),
  requested_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ck_notifications_type CHECK (type IN ('RECEPTION', 'QUOTATION', 'READY_FOR_PICKUP', 'DELIVERY')),
  CONSTRAINT ck_notifications_trigger CHECK (trigger IN ('AUTOMATIC', 'MANUAL')),
  CONSTRAINT ck_notifications_status CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  CONSTRAINT ck_notifications_attempts CHECK (attempts >= 0 AND max_attempts > 0)
);
-- Índice parcial: el worker sólo consulta pendientes vencidas
CREATE INDEX ix_notifications_pending ON notifications (next_attempt_at) WHERE status = 'PENDING';
CREATE INDEX ix_notifications_work_order ON notifications (work_order_id, created_at DESC);
CREATE INDEX ix_notifications_failed ON notifications (created_at DESC) WHERE status = 'FAILED';
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
