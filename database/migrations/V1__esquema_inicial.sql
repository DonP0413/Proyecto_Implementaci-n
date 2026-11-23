-- =============================================================================
-- V1__esquema_inicial.sql
-- Objetivo: crear el esquema relacional completo de PINTOTECH en SQLite
-- (aplicación local de escritorio, un solo archivo de base de datos).
-- Convenciones:
--   * snake_case, tablas en plural.
--   * PK UUID como TEXT (la aplicación los genera). status_history usa
--     INTEGER autoincremental.
--   * Fechas-hora como TEXT 'YYYY-MM-DD HH:MM:SS.SSS' en UTC (formato de
--     TypeORM); fechas de calendario como TEXT 'YYYY-MM-DD'.
--   * JSON como TEXT (columnas simple-json de TypeORM).
--   * Booleanos como INTEGER 0/1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS: personal de la tienda (administrador, recepcionista, técnico)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id             VARCHAR(36)  PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN', 'RECEPCIONISTA', 'TECNICO')),
  is_active      BOOLEAN      NOT NULL DEFAULT 1,
  last_login_at  DATETIME,
  created_at     DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at     DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));

-- -----------------------------------------------------------------------------
-- CLIENTS: dueños de los equipos
-- -----------------------------------------------------------------------------
CREATE TABLE clients (
  id             VARCHAR(36)  PRIMARY KEY,
  full_name      VARCHAR(150) NOT NULL CHECK (length(trim(full_name)) > 0),
  document_id    VARCHAR(20),
  email          VARCHAR(160) NOT NULL,
  phone          VARCHAR(20),
  address        VARCHAR(250),
  registered_at  DATE         NOT NULL DEFAULT (date('now')),
  created_at     DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at     DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE UNIQUE INDEX ux_clients_document_id ON clients (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX ix_clients_email_lower ON clients (lower(email));
CREATE INDEX ix_clients_registered_at ON clients (registered_at DESC);

-- -----------------------------------------------------------------------------
-- EQUIPMENT_TYPES: catálogo (laptop, impresora 3D, tarjeta madre, ...)
-- spec_schema define los campos técnicos que el frontend debe pedir.
-- -----------------------------------------------------------------------------
CREATE TABLE equipment_types (
  id           INTEGER      PRIMARY KEY AUTOINCREMENT,
  code         VARCHAR(30)  NOT NULL UNIQUE,
  name         VARCHAR(80)  NOT NULL,
  spec_schema  TEXT         NOT NULL DEFAULT '[]' CHECK (json_valid(spec_schema) AND json_type(spec_schema) = 'array'),
  is_active    BOOLEAN      NOT NULL DEFAULT 1
);

-- -----------------------------------------------------------------------------
-- EQUIPMENTS: equipo físico de un cliente (historial por número de serie)
-- -----------------------------------------------------------------------------
CREATE TABLE equipments (
  id                 VARCHAR(36)  PRIMARY KEY,
  client_id          VARCHAR(36)  NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  equipment_type_id  SMALLINT     NOT NULL REFERENCES equipment_types(id) ON DELETE RESTRICT,
  brand              VARCHAR(60)  NOT NULL,
  model              VARCHAR(80)  NOT NULL,
  serial_number      VARCHAR(80),
  technical_specs    TEXT         NOT NULL DEFAULT '{}' CHECK (json_valid(technical_specs) AND json_type(technical_specs) = 'object'),
  created_at         DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at         DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX ix_equipments_client_id ON equipments (client_id);
CREATE INDEX ix_equipments_serial_lower ON equipments (lower(serial_number)) WHERE serial_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- SEQUENCES: reemplaza los SEQUENCE de PostgreSQL (consecutivo del ID de trabajo)
-- -----------------------------------------------------------------------------
CREATE TABLE sequences (
  name   VARCHAR(50) PRIMARY KEY,
  value  INTEGER     NOT NULL DEFAULT 0
);
INSERT INTO sequences (name, value) VALUES ('work_order_code', 0);

-- -----------------------------------------------------------------------------
-- WORK_ORDERS: orden de trabajo (ID único de trabajo = code)
-- -----------------------------------------------------------------------------
CREATE TABLE work_orders (
  id                       VARCHAR(36)  PRIMARY KEY,
  code                     VARCHAR(20)  NOT NULL UNIQUE,
  client_id                VARCHAR(36)  NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  equipment_id             VARCHAR(36)  NOT NULL REFERENCES equipments(id) ON DELETE RESTRICT,
  status                   VARCHAR(30)  NOT NULL DEFAULT 'INGRESADO' CHECK (status IN (
                             'INGRESADO', 'EN_REVISION', 'COTIZACION_GENERADA',
                             'EN_REPARACION', 'LISTO_PARA_RETIRAR', 'ENTREGADO')),
  reported_issue           TEXT         NOT NULL,
  specs_snapshot           TEXT         NOT NULL DEFAULT '{}',
  received_at              DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  received_by              VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_technician_id   VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  estimated_delivery_date  DATE,
  delivered_at             DATETIME,
  created_at               DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at               DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  CHECK ((status = 'ENTREGADO' AND delivered_at IS NOT NULL) OR
         (status <> 'ENTREGADO' AND delivered_at IS NULL))
);
CREATE INDEX ix_work_orders_status_received ON work_orders (status, received_at DESC);
CREATE INDEX ix_work_orders_received_at ON work_orders (received_at DESC);
CREATE INDEX ix_work_orders_client_id ON work_orders (client_id);
CREATE INDEX ix_work_orders_equipment_id ON work_orders (equipment_id);
CREATE INDEX ix_work_orders_technician ON work_orders (assigned_technician_id) WHERE assigned_technician_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RECEPTION_CONDITIONS (1:1): estado físico y funcional al recibir
-- -----------------------------------------------------------------------------
CREATE TABLE reception_conditions (
  work_order_id       VARCHAR(36)  PRIMARY KEY REFERENCES work_orders(id) ON DELETE CASCADE,
  power_status        VARCHAR(12)  NOT NULL CHECK (power_status IN ('SI', 'NO', 'NO_PROBADO')),
  physical_condition  VARCHAR(10)  NOT NULL CHECK (physical_condition IN ('BUENO', 'REGULAR', 'MALO')),
  visible_damage      TEXT,
  functional_notes    TEXT,
  created_at          DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

-- -----------------------------------------------------------------------------
-- WORK_ORDER_ACCESSORIES (1:N): accesorios recibidos / devueltos
-- -----------------------------------------------------------------------------
CREATE TABLE work_order_accessories (
  id             VARCHAR(36)  PRIMARY KEY,
  work_order_id  VARCHAR(36)  NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name           VARCHAR(80)  NOT NULL,
  quantity       SMALLINT     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes          VARCHAR(200),
  returned       BOOLEAN      NOT NULL DEFAULT 0
);
CREATE INDEX ix_accessories_work_order ON work_order_accessories (work_order_id);

-- -----------------------------------------------------------------------------
-- QUOTATIONS (1:N): cotizaciones (puede haber re-cotización)
-- -----------------------------------------------------------------------------
CREATE TABLE quotations (
  id              VARCHAR(36)     PRIMARY KEY,
  work_order_id   VARCHAR(36)     NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  amount          NUMERIC(10, 2)  NOT NULL CHECK (amount >= 0),
  description     TEXT            NOT NULL,
  estimated_days  SMALLINT        CHECK (estimated_days IS NULL OR estimated_days > 0),
  created_by      VARCHAR(36)     NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      DATETIME        NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  notified_at     DATETIME
);
CREATE INDEX ix_quotations_work_order ON quotations (work_order_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TECHNICAL_LOGS (1:N): registro interno del técnico (NUNCA visible al cliente)
-- -----------------------------------------------------------------------------
CREATE TABLE technical_logs (
  id              VARCHAR(36)  PRIMARY KEY,
  work_order_id   VARCHAR(36)  NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  author_id       VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  diagnosis       TEXT,
  procedures      TEXT,
  configurations  TEXT,
  spare_parts     TEXT,
  observations    TEXT,
  created_at      DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  CHECK (COALESCE(diagnosis, procedures, configurations, spare_parts, observations) IS NOT NULL)
);
CREATE INDEX ix_technical_logs_work_order ON technical_logs (work_order_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- DELIVERY_RECORDS (1:1): información visible para el cliente en la entrega
-- -----------------------------------------------------------------------------
CREATE TABLE delivery_records (
  work_order_id         VARCHAR(36)     PRIMARY KEY REFERENCES work_orders(id) ON DELETE CASCADE,
  work_summary          TEXT            NOT NULL,
  amount_charged        NUMERIC(10, 2)  NOT NULL CHECK (amount_charged >= 0),
  return_condition      TEXT            NOT NULL,
  accessories_notes     VARCHAR(500),
  received_by_name      VARCHAR(150)    NOT NULL,
  received_by_document  VARCHAR(20),
  delivered_by          VARCHAR(36)     NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  delivered_at          DATETIME        NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

-- -----------------------------------------------------------------------------
-- ATTACHMENTS (1:N): fotografías y documentos. visibility separa lo visible
-- al cliente de lo interno; la regla se refuerza a nivel de BD.
-- -----------------------------------------------------------------------------
CREATE TABLE attachments (
  id                VARCHAR(36)   PRIMARY KEY,
  work_order_id     VARCHAR(36)   NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  technical_log_id  VARCHAR(36)   REFERENCES technical_logs(id) ON DELETE SET NULL,
  category          VARCHAR(30)   NOT NULL CHECK (category IN (
                      'RECEPTION_PHOTO', 'DELIVERY_PHOTO', 'TECHNICAL_DOCUMENT', 'RECEIPT_PDF')),
  visibility        VARCHAR(10)   NOT NULL CHECK (visibility IN ('CLIENT', 'INTERNAL')),
  original_name     VARCHAR(255)  NOT NULL,
  storage_key       VARCHAR(300)  NOT NULL UNIQUE,
  mime_type         VARCHAR(100)  NOT NULL,
  size_bytes        INTEGER       NOT NULL CHECK (size_bytes > 0),
  uploaded_by       VARCHAR(36)   REFERENCES users(id) ON DELETE SET NULL,
  created_at        DATETIME      NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  CHECK (category <> 'TECHNICAL_DOCUMENT' OR visibility = 'INTERNAL')
);
CREATE INDEX ix_attachments_work_order ON attachments (work_order_id, category);

-- -----------------------------------------------------------------------------
-- STATUS_HISTORY (1:N): trazabilidad de cada cambio de estado (auditoría)
-- -----------------------------------------------------------------------------
CREATE TABLE status_history (
  id             INTEGER      PRIMARY KEY AUTOINCREMENT,
  work_order_id  VARCHAR(36)  NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  from_status    VARCHAR(30),
  to_status      VARCHAR(30)  NOT NULL,
  note           VARCHAR(500),
  changed_by     VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  changed_at     DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX ix_status_history_work_order ON status_history (work_order_id, changed_at);

-- -----------------------------------------------------------------------------
-- Catálogo de tipos de equipo con características técnicas detalladas.
-- Formato de cada campo de spec_schema:
--   { key, label, type: text|number|textarea|select, group?, placeholder?,
--     hint?, unit?, options?: [..], min?, max?, legacy? }
-- -----------------------------------------------------------------------------

INSERT INTO equipment_types (code, name, spec_schema) VALUES
('LAPTOP', 'Laptop', '[
  {"key":"processor","label":"Procesador","type":"text","placeholder":"Intel Core i5-1135G7"},
  {"key":"ram","label":"Memoria RAM","type":"text","placeholder":"16 GB DDR4"},
  {"key":"storage","label":"Almacenamiento","type":"text","placeholder":"512 GB SSD NVMe"},
  {"key":"screen","label":"Pantalla","type":"text","placeholder":"15.6\" FHD"},
  {"key":"gpu","label":"Tarjeta gráfica","type":"text"},
  {"key":"os","label":"Sistema operativo","type":"text","placeholder":"Windows 11"}
]'),
('DESKTOP', 'Computadora de escritorio', '[
  {"key":"processor","label":"Procesador","type":"text"},
  {"key":"ram","label":"Memoria RAM","type":"text"},
  {"key":"storage","label":"Almacenamiento","type":"text"},
  {"key":"gpu","label":"Tarjeta gráfica","type":"text"},
  {"key":"power_supply","label":"Fuente de poder","type":"text","placeholder":"650 W"},
  {"key":"os","label":"Sistema operativo","type":"text"}
]'),
('PRINTER_3D', 'Impresora 3D', '[
  {"key":"technology","label":"Tecnología","type":"text","placeholder":"FDM / Resina"},
  {"key":"build_volume","label":"Volumen de impresión","type":"text","placeholder":"220x220x250 mm"},
  {"key":"nozzle","label":"Boquilla","type":"text","placeholder":"0.4 mm"},
  {"key":"extruder","label":"Extrusor","type":"text","placeholder":"Directo / Bowden"},
  {"key":"firmware","label":"Firmware","type":"text","placeholder":"Marlin 2.1"}
]'),
('MOTHERBOARD', 'Tarjeta madre', '[
  {"key":"socket","label":"Socket","type":"text","placeholder":"AM4 / LGA1700"},
  {"key":"chipset","label":"Chipset","type":"text","placeholder":"B550"},
  {"key":"form_factor","label":"Formato","type":"text","placeholder":"ATX / mATX"},
  {"key":"ram_slots","label":"Slots de RAM","type":"number"},
  {"key":"bios_version","label":"Versión BIOS","type":"text"}
]'),
('PRINTER', 'Impresora', '[
  {"key":"printer_type","label":"Tipo","type":"text","placeholder":"Láser / Inyección / Tanque"},
  {"key":"connectivity","label":"Conectividad","type":"text","placeholder":"USB / WiFi"},
  {"key":"page_counter","label":"Contador de páginas","type":"number"}
]'),
('MOBILE', 'Celular / Tablet', '[
  {"key":"ram","label":"Memoria RAM","type":"text"},
  {"key":"storage","label":"Capacidad","type":"text","placeholder":"128 GB"},
  {"key":"imei","label":"IMEI","type":"text"},
  {"key":"battery_health","label":"Salud de batería","type":"text"}
]'),
('OTHER', 'Otro', '[
  {"key":"description","label":"Características técnicas","type":"textarea"}
]')
ON CONFLICT (code) DO NOTHING;

UPDATE equipment_types SET spec_schema = '[
  {"key":"cpu_brand","group":"Procesador","label":"Marca","type":"select","options":["Intel","AMD","Apple","Qualcomm","MediaTek","Otro"]},
  {"key":"cpu_model","group":"Procesador","label":"Modelo","type":"text","placeholder":"Ej.: Core i5-1135G7, Ryzen 5 5500U, M2"},
  {"key":"cpu_generation","group":"Procesador","label":"Generación","type":"text","placeholder":"Ej.: 11.ª generación"},
  {"key":"ram_gb","group":"Memoria RAM","label":"Capacidad","type":"number","unit":"GB","min":1,"max":512,"placeholder":"Ej.: 16"},
  {"key":"ram_type","group":"Memoria RAM","label":"Tipo","type":"select","options":["DDR3","DDR3L","DDR4","DDR5","LPDDR4X","LPDDR5","Unificada (Apple)","No determinado"]},
  {"key":"ram_speed","group":"Memoria RAM","label":"Velocidad","type":"number","unit":"MHz","min":100,"max":10000,"placeholder":"Ej.: 3200"},
  {"key":"ram_modules","group":"Memoria RAM","label":"Módulos instalados","type":"text","placeholder":"Ej.: 2 x 8 GB o soldada"},
  {"key":"ram_free_slots","group":"Memoria RAM","label":"Slots libres","type":"number","min":0,"max":8,"placeholder":"Ej.: 0"},
  {"key":"storage1_type","group":"Almacenamiento principal","label":"Tipo","type":"select","options":["SSD NVMe","SSD SATA","HDD","eMMC","Otro"]},
  {"key":"storage1_gb","group":"Almacenamiento principal","label":"Capacidad","type":"number","unit":"GB","min":1,"max":100000,"placeholder":"Ej.: 512"},
  {"key":"storage1_model","group":"Almacenamiento principal","label":"Marca / modelo","type":"text","placeholder":"Ej.: Kingston NV2, WD Blue"},
  {"key":"storage1_health","group":"Almacenamiento principal","label":"Salud","type":"number","unit":"%","min":0,"max":100,"placeholder":"Ej.: 95","hint":"Según CrystalDiskInfo u otra herramienta"},
  {"key":"storage2_type","group":"Almacenamiento secundario","label":"Tipo","type":"select","options":["SSD NVMe","SSD SATA","HDD","eMMC","Otro"]},
  {"key":"storage2_gb","group":"Almacenamiento secundario","label":"Capacidad","type":"number","unit":"GB","min":1,"max":100000,"placeholder":"Ej.: 1000"},
  {"key":"screen_size","group":"Pantalla","label":"Tamaño","type":"number","unit":"pulgadas","min":5,"max":40,"placeholder":"Ej.: 15.6"},
  {"key":"screen_resolution","group":"Pantalla","label":"Resolución","type":"select","options":["HD (1366x768)","HD+ (1600x900)","FHD (1920x1080)","2K / QHD","4K / UHD","Otra"]},
  {"key":"screen_touch","group":"Pantalla","label":"Táctil","type":"select","options":["Sí","No"]},
  {"key":"gpu_type","group":"Gráficos","label":"Tipo","type":"select","options":["Integrada","Dedicada","Integrada + dedicada"]},
  {"key":"gpu_model","group":"Gráficos","label":"Modelo","type":"text","placeholder":"Ej.: NVIDIA GeForce RTX 3050, Intel Iris Xe"},
  {"key":"gpu_vram","group":"Gráficos","label":"Memoria de video","type":"number","unit":"GB","min":1,"max":64,"placeholder":"Ej.: 4"},
  {"key":"battery_health","group":"Batería y carga","label":"Salud de batería","type":"number","unit":"%","min":0,"max":100,"placeholder":"Ej.: 80","hint":"Capacidad actual respecto a la de fábrica"},
  {"key":"charger_watts","group":"Batería y carga","label":"Potencia del cargador","type":"number","unit":"W","min":1,"max":500,"placeholder":"Ej.: 65"},
  {"key":"os","group":"Sistema","label":"Sistema operativo","type":"text","placeholder":"Ej.: Windows 11 Home, macOS Sonoma"},
  {"key":"os_license","group":"Sistema","label":"Licencia","type":"select","options":["Original","No original","Sin sistema operativo","No determinado"]},
  {"key":"processor","label":"Procesador","type":"text","legacy":true},
  {"key":"ram","label":"Memoria RAM","type":"text","legacy":true},
  {"key":"storage","label":"Almacenamiento","type":"text","legacy":true},
  {"key":"screen","label":"Pantalla","type":"text","legacy":true},
  {"key":"gpu","label":"Tarjeta gráfica","type":"text","legacy":true}
]' WHERE code = 'LAPTOP';

UPDATE equipment_types SET spec_schema = '[
  {"key":"cpu_brand","group":"Procesador","label":"Marca","type":"select","options":["Intel","AMD","Otro"]},
  {"key":"cpu_model","group":"Procesador","label":"Modelo","type":"text","placeholder":"Ej.: Core i7-12700, Ryzen 7 5700X"},
  {"key":"cpu_generation","group":"Procesador","label":"Generación","type":"text","placeholder":"Ej.: 12.ª generación"},
  {"key":"motherboard","group":"Placa madre","label":"Modelo","type":"text","placeholder":"Ej.: ASUS Prime B550M-A"},
  {"key":"ram_gb","group":"Memoria RAM","label":"Capacidad","type":"number","unit":"GB","min":1,"max":1024,"placeholder":"Ej.: 32"},
  {"key":"ram_type","group":"Memoria RAM","label":"Tipo","type":"select","options":["DDR3","DDR4","DDR5","No determinado"]},
  {"key":"ram_speed","group":"Memoria RAM","label":"Velocidad","type":"number","unit":"MHz","min":100,"max":10000,"placeholder":"Ej.: 3600"},
  {"key":"ram_modules","group":"Memoria RAM","label":"Módulos instalados","type":"text","placeholder":"Ej.: 2 x 16 GB"},
  {"key":"ram_free_slots","group":"Memoria RAM","label":"Slots libres","type":"number","min":0,"max":8,"placeholder":"Ej.: 2"},
  {"key":"storage1_type","group":"Almacenamiento principal","label":"Tipo","type":"select","options":["SSD NVMe","SSD SATA","HDD","Otro"]},
  {"key":"storage1_gb","group":"Almacenamiento principal","label":"Capacidad","type":"number","unit":"GB","min":1,"max":100000,"placeholder":"Ej.: 1000"},
  {"key":"storage1_model","group":"Almacenamiento principal","label":"Marca / modelo","type":"text","placeholder":"Ej.: Samsung 980, Seagate Barracuda"},
  {"key":"storage1_health","group":"Almacenamiento principal","label":"Salud","type":"number","unit":"%","min":0,"max":100,"placeholder":"Ej.: 95","hint":"Según CrystalDiskInfo u otra herramienta"},
  {"key":"storage2_type","group":"Almacenamiento secundario","label":"Tipo","type":"select","options":["SSD NVMe","SSD SATA","HDD","Otro"]},
  {"key":"storage2_gb","group":"Almacenamiento secundario","label":"Capacidad","type":"number","unit":"GB","min":1,"max":100000,"placeholder":"Ej.: 2000"},
  {"key":"gpu_type","group":"Gráficos","label":"Tipo","type":"select","options":["Integrada","Dedicada","Integrada + dedicada"]},
  {"key":"gpu_model","group":"Gráficos","label":"Modelo","type":"text","placeholder":"Ej.: NVIDIA GeForce RTX 4060, AMD Radeon RX 6600"},
  {"key":"gpu_vram","group":"Gráficos","label":"Memoria de video","type":"number","unit":"GB","min":1,"max":64,"placeholder":"Ej.: 8"},
  {"key":"psu_watts","group":"Fuente de poder","label":"Potencia","type":"number","unit":"W","min":100,"max":3000,"placeholder":"Ej.: 650"},
  {"key":"psu_model","group":"Fuente de poder","label":"Marca / modelo","type":"text","placeholder":"Ej.: EVGA 600 W1, Corsair CV650"},
  {"key":"os","group":"Sistema","label":"Sistema operativo","type":"text","placeholder":"Ej.: Windows 11 Pro, Ubuntu 24.04"},
  {"key":"os_license","group":"Sistema","label":"Licencia","type":"select","options":["Original","No original","Sin sistema operativo","No determinado"]},
  {"key":"processor","label":"Procesador","type":"text","legacy":true},
  {"key":"ram","label":"Memoria RAM","type":"text","legacy":true},
  {"key":"storage","label":"Almacenamiento","type":"text","legacy":true},
  {"key":"gpu","label":"Tarjeta gráfica","type":"text","legacy":true},
  {"key":"power_supply","label":"Fuente de poder","type":"text","legacy":true}
]' WHERE code = 'DESKTOP';

UPDATE equipment_types SET spec_schema = '[
  {"key":"technology","group":"Impresora 3D","label":"Tecnología","type":"select","options":["FDM (filamento)","Resina (SLA / MSLA)","Otra"]},
  {"key":"build_volume","group":"Impresora 3D","label":"Volumen de impresión","type":"text","placeholder":"Ej.: 220 x 220 x 250 mm"},
  {"key":"nozzle","group":"Extrusión","label":"Diámetro de boquilla","type":"number","unit":"mm","min":0.1,"max":2,"placeholder":"Ej.: 0.4"},
  {"key":"extruder","group":"Extrusión","label":"Extrusor","type":"select","options":["Directo","Bowden"]},
  {"key":"filament","group":"Extrusión","label":"Filamento / resina habitual","type":"text","placeholder":"Ej.: PLA 1.75 mm, PETG"},
  {"key":"firmware","group":"Electrónica","label":"Firmware","type":"text","placeholder":"Ej.: Marlin 2.1, Klipper"},
  {"key":"mainboard","group":"Electrónica","label":"Placa controladora","type":"text","placeholder":"Ej.: Creality 4.2.7, BTT SKR Mini E3"}
]' WHERE code = 'PRINTER_3D';

UPDATE equipment_types SET spec_schema = '[
  {"key":"socket","group":"Tarjeta madre","label":"Socket","type":"text","placeholder":"Ej.: AM4, LGA1700"},
  {"key":"chipset","group":"Tarjeta madre","label":"Chipset","type":"text","placeholder":"Ej.: B550, H610"},
  {"key":"form_factor","group":"Tarjeta madre","label":"Formato","type":"select","options":["ATX","Micro-ATX","Mini-ITX","E-ATX","Propietario (OEM)"]},
  {"key":"ram_slots","group":"Memoria","label":"Slots de RAM","type":"number","min":1,"max":16,"placeholder":"Ej.: 4"},
  {"key":"ram_type","group":"Memoria","label":"Tipo de RAM soportada","type":"select","options":["DDR3","DDR4","DDR5"]},
  {"key":"bios_version","group":"Firmware","label":"Versión BIOS","type":"text","placeholder":"Ej.: F12, 1.40"}
]' WHERE code = 'MOTHERBOARD';

UPDATE equipment_types SET spec_schema = '[
  {"key":"printer_type","group":"Impresora","label":"Tipo","type":"select","options":["Láser","Inyección de tinta","Tanque de tinta","Térmica","Matricial"]},
  {"key":"color","group":"Impresora","label":"Color","type":"select","options":["Monocromática","A color"]},
  {"key":"multifunction","group":"Impresora","label":"Multifunción","type":"select","options":["Sí (escáner/copiadora)","No"]},
  {"key":"connectivity","group":"Impresora","label":"Conectividad","type":"text","placeholder":"Ej.: USB, WiFi, Ethernet"},
  {"key":"page_counter","group":"Uso","label":"Contador de páginas","type":"number","min":0,"max":100000000,"placeholder":"Ej.: 15230","hint":"Desde el panel o la página de configuración"},
  {"key":"consumable","group":"Uso","label":"Cartucho / tóner","type":"text","placeholder":"Ej.: HP 664, Brother TN-1060"}
]' WHERE code = 'PRINTER';

UPDATE equipment_types SET spec_schema = '[
  {"key":"ram_gb","group":"Memoria","label":"RAM","type":"number","unit":"GB","min":1,"max":64,"placeholder":"Ej.: 8"},
  {"key":"storage_gb","group":"Memoria","label":"Almacenamiento","type":"number","unit":"GB","min":1,"max":4096,"placeholder":"Ej.: 128"},
  {"key":"screen_size","group":"Pantalla","label":"Tamaño","type":"number","unit":"pulgadas","min":3,"max":20,"placeholder":"Ej.: 6.5"},
  {"key":"imei","group":"Identificación","label":"IMEI","type":"text","placeholder":"15 dígitos (marque *#06#)"},
  {"key":"battery_health","group":"Batería","label":"Salud de batería","type":"number","unit":"%","min":0,"max":100,"placeholder":"Ej.: 85"},
  {"key":"os","group":"Sistema","label":"Sistema operativo","type":"text","placeholder":"Ej.: Android 14, iOS 17"},
  {"key":"ram","label":"Memoria RAM","type":"text","legacy":true},
  {"key":"storage","label":"Capacidad","type":"text","legacy":true}
]' WHERE code = 'MOBILE';

UPDATE equipment_types SET spec_schema = '[
  {"key":"description","label":"Características técnicas","type":"textarea","placeholder":"Describa el equipo: componentes, capacidades, versión, etc."}
]' WHERE code = 'OTHER';
