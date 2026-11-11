-- =============================================================================
-- V2__catalogo_tipos_equipo.sql
-- Objetivo: cargar el catálogo de tipos de equipo que repara PINTOTECH
-- (laptops, impresoras 3D, tarjetas madre, etc.) con el esquema de
-- características técnicas que se pedirán en el formulario de ingreso.
-- Cada elemento de spec_schema: { key, label, type: text|number|textarea, placeholder? }
-- =============================================================================

INSERT INTO equipment_types (code, name, spec_schema) VALUES
('LAPTOP', 'Laptop', '[
  {"key":"processor","label":"Procesador","type":"text","placeholder":"Intel Core i5-1135G7"},
  {"key":"ram","label":"Memoria RAM","type":"text","placeholder":"16 GB DDR4"},
  {"key":"storage","label":"Almacenamiento","type":"text","placeholder":"512 GB SSD NVMe"},
  {"key":"screen","label":"Pantalla","type":"text","placeholder":"15.6\" FHD"},
  {"key":"gpu","label":"Tarjeta gráfica","type":"text"},
  {"key":"os","label":"Sistema operativo","type":"text","placeholder":"Windows 11"}
]'::jsonb),
('DESKTOP', 'Computadora de escritorio', '[
  {"key":"processor","label":"Procesador","type":"text"},
  {"key":"ram","label":"Memoria RAM","type":"text"},
  {"key":"storage","label":"Almacenamiento","type":"text"},
  {"key":"gpu","label":"Tarjeta gráfica","type":"text"},
  {"key":"power_supply","label":"Fuente de poder","type":"text","placeholder":"650 W"},
  {"key":"os","label":"Sistema operativo","type":"text"}
]'::jsonb),
('PRINTER_3D', 'Impresora 3D', '[
  {"key":"technology","label":"Tecnología","type":"text","placeholder":"FDM / Resina"},
  {"key":"build_volume","label":"Volumen de impresión","type":"text","placeholder":"220x220x250 mm"},
  {"key":"nozzle","label":"Boquilla","type":"text","placeholder":"0.4 mm"},
  {"key":"extruder","label":"Extrusor","type":"text","placeholder":"Directo / Bowden"},
  {"key":"firmware","label":"Firmware","type":"text","placeholder":"Marlin 2.1"}
]'::jsonb),
('MOTHERBOARD', 'Tarjeta madre', '[
  {"key":"socket","label":"Socket","type":"text","placeholder":"AM4 / LGA1700"},
  {"key":"chipset","label":"Chipset","type":"text","placeholder":"B550"},
  {"key":"form_factor","label":"Formato","type":"text","placeholder":"ATX / mATX"},
  {"key":"ram_slots","label":"Slots de RAM","type":"number"},
  {"key":"bios_version","label":"Versión BIOS","type":"text"}
]'::jsonb),
('PRINTER', 'Impresora', '[
  {"key":"printer_type","label":"Tipo","type":"text","placeholder":"Láser / Inyección / Tanque"},
  {"key":"connectivity","label":"Conectividad","type":"text","placeholder":"USB / WiFi"},
  {"key":"page_counter","label":"Contador de páginas","type":"number"}
]'::jsonb),
('MOBILE', 'Celular / Tablet', '[
  {"key":"ram","label":"Memoria RAM","type":"text"},
  {"key":"storage","label":"Capacidad","type":"text","placeholder":"128 GB"},
  {"key":"imei","label":"IMEI","type":"text"},
  {"key":"battery_health","label":"Salud de batería","type":"text"}
]'::jsonb),
('OTHER', 'Otro', '[
  {"key":"description","label":"Características técnicas","type":"textarea"}
]'::jsonb)
ON CONFLICT (code) DO NOTHING;
