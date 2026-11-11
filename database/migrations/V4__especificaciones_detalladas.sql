-- =============================================================================
-- V4__especificaciones_detalladas.sql
-- Objetivo: características técnicas DETALLADAS y opcionales por tipo de equipo
-- (RAM: capacidad, tipo, velocidad…; almacenamiento: tipo, capacidad, salud…),
-- agrupadas, con listas de opciones para evitar texto inconsistente
-- ("16gb" vs "16 GB DDR4") y placeholders que guían a recepción.
--
-- Formato de cada campo de spec_schema:
--   { key, label, type: text|number|textarea|select, group?, placeholder?,
--     hint?, unit?, options?: [..], min?, max?, legacy? }
--   - unit   : se agrega al valor al mostrarlo ("16" -> "16 GB").
--   - legacy : campo de la versión anterior (V2). No se pide en el formulario,
--              pero conserva su etiqueta para mostrar órdenes antiguas.
-- Las órdenes existentes no cambian: guardan una copia (specs_snapshot).
-- =============================================================================

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
]'::jsonb WHERE code = 'LAPTOP';

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
]'::jsonb WHERE code = 'DESKTOP';

UPDATE equipment_types SET spec_schema = '[
  {"key":"technology","group":"Impresora 3D","label":"Tecnología","type":"select","options":["FDM (filamento)","Resina (SLA / MSLA)","Otra"]},
  {"key":"build_volume","group":"Impresora 3D","label":"Volumen de impresión","type":"text","placeholder":"Ej.: 220 x 220 x 250 mm"},
  {"key":"nozzle","group":"Extrusión","label":"Diámetro de boquilla","type":"number","unit":"mm","min":0.1,"max":2,"placeholder":"Ej.: 0.4"},
  {"key":"extruder","group":"Extrusión","label":"Extrusor","type":"select","options":["Directo","Bowden"]},
  {"key":"filament","group":"Extrusión","label":"Filamento / resina habitual","type":"text","placeholder":"Ej.: PLA 1.75 mm, PETG"},
  {"key":"firmware","group":"Electrónica","label":"Firmware","type":"text","placeholder":"Ej.: Marlin 2.1, Klipper"},
  {"key":"mainboard","group":"Electrónica","label":"Placa controladora","type":"text","placeholder":"Ej.: Creality 4.2.7, BTT SKR Mini E3"}
]'::jsonb WHERE code = 'PRINTER_3D';

UPDATE equipment_types SET spec_schema = '[
  {"key":"socket","group":"Tarjeta madre","label":"Socket","type":"text","placeholder":"Ej.: AM4, LGA1700"},
  {"key":"chipset","group":"Tarjeta madre","label":"Chipset","type":"text","placeholder":"Ej.: B550, H610"},
  {"key":"form_factor","group":"Tarjeta madre","label":"Formato","type":"select","options":["ATX","Micro-ATX","Mini-ITX","E-ATX","Propietario (OEM)"]},
  {"key":"ram_slots","group":"Memoria","label":"Slots de RAM","type":"number","min":1,"max":16,"placeholder":"Ej.: 4"},
  {"key":"ram_type","group":"Memoria","label":"Tipo de RAM soportada","type":"select","options":["DDR3","DDR4","DDR5"]},
  {"key":"bios_version","group":"Firmware","label":"Versión BIOS","type":"text","placeholder":"Ej.: F12, 1.40"}
]'::jsonb WHERE code = 'MOTHERBOARD';

UPDATE equipment_types SET spec_schema = '[
  {"key":"printer_type","group":"Impresora","label":"Tipo","type":"select","options":["Láser","Inyección de tinta","Tanque de tinta","Térmica","Matricial"]},
  {"key":"color","group":"Impresora","label":"Color","type":"select","options":["Monocromática","A color"]},
  {"key":"multifunction","group":"Impresora","label":"Multifunción","type":"select","options":["Sí (escáner/copiadora)","No"]},
  {"key":"connectivity","group":"Impresora","label":"Conectividad","type":"text","placeholder":"Ej.: USB, WiFi, Ethernet"},
  {"key":"page_counter","group":"Uso","label":"Contador de páginas","type":"number","min":0,"max":100000000,"placeholder":"Ej.: 15230","hint":"Desde el panel o la página de configuración"},
  {"key":"consumable","group":"Uso","label":"Cartucho / tóner","type":"text","placeholder":"Ej.: HP 664, Brother TN-1060"}
]'::jsonb WHERE code = 'PRINTER';

UPDATE equipment_types SET spec_schema = '[
  {"key":"ram_gb","group":"Memoria","label":"RAM","type":"number","unit":"GB","min":1,"max":64,"placeholder":"Ej.: 8"},
  {"key":"storage_gb","group":"Memoria","label":"Almacenamiento","type":"number","unit":"GB","min":1,"max":4096,"placeholder":"Ej.: 128"},
  {"key":"screen_size","group":"Pantalla","label":"Tamaño","type":"number","unit":"pulgadas","min":3,"max":20,"placeholder":"Ej.: 6.5"},
  {"key":"imei","group":"Identificación","label":"IMEI","type":"text","placeholder":"15 dígitos (marque *#06#)"},
  {"key":"battery_health","group":"Batería","label":"Salud de batería","type":"number","unit":"%","min":0,"max":100,"placeholder":"Ej.: 85"},
  {"key":"os","group":"Sistema","label":"Sistema operativo","type":"text","placeholder":"Ej.: Android 14, iOS 17"},
  {"key":"ram","label":"Memoria RAM","type":"text","legacy":true},
  {"key":"storage","label":"Capacidad","type":"text","legacy":true}
]'::jsonb WHERE code = 'MOBILE';

UPDATE equipment_types SET spec_schema = '[
  {"key":"description","label":"Características técnicas","type":"textarea","placeholder":"Describa el equipo: componentes, capacidades, versión, etc."}
]'::jsonb WHERE code = 'OTHER';
