-- =============================================================================
-- consultas_frecuentes.sql
-- Objetivo: documentar las consultas más frecuentes del sistema y el índice
-- que cada una aprovecha. Úsese con EXPLAIN (ANALYZE, BUFFERS) en staging.
-- =============================================================================

-- 1) Buscar por ID de trabajo (exacto) -> ux_work_orders_code
SELECT * FROM work_orders WHERE code = 'PT-2026-000001';

-- 2) Buscar por ID parcial (ej. el cliente dicta "000123") -> ix_work_orders_code_trgm
SELECT id, code, status FROM work_orders WHERE code ILIKE '%000123%';

-- 3) Bandeja de trabajo por estado, más recientes primero -> ix_work_orders_status_received
SELECT wo.code, wo.status, wo.received_at, c.full_name, e.brand, e.model
FROM work_orders wo
JOIN clients c    ON c.id = wo.client_id
JOIN equipments e ON e.id = wo.equipment_id
WHERE wo.status = 'EN_REVISION'
ORDER BY wo.received_at DESC
LIMIT 20 OFFSET 0;

-- 4) Buscar por cliente (nombre parcial) -> ix_clients_full_name_trgm
SELECT wo.code, wo.status, c.full_name
FROM work_orders wo JOIN clients c ON c.id = wo.client_id
WHERE c.full_name ILIKE '%perez%'
ORDER BY wo.received_at DESC;

-- 5) Historial de reparaciones por número de serie -> ix_equipments_serial_lower
SELECT wo.code, wo.status, wo.received_at, dr.work_summary, dr.amount_charged
FROM equipments e
JOIN work_orders wo ON wo.equipment_id = e.id
LEFT JOIN delivery_records dr ON dr.work_order_id = wo.id
WHERE lower(e.serial_number) = lower('5CD1234XYZ')
ORDER BY wo.received_at DESC;

-- 6) Rango de fechas de ingreso -> ix_work_orders_received_at
SELECT code, status FROM work_orders
WHERE received_at >= '2026-11-01'::timestamptz AND received_at < '2026-12-01'::timestamptz;

-- 7) Tablero: conteo por estado (index-only scan sobre ix_work_orders_status_received)
SELECT status, count(*) FROM work_orders GROUP BY status;

-- 8) Worker de notificaciones (outbox) -> ix_notifications_pending (índice parcial)
WITH claimed AS (
  UPDATE notifications SET status = 'SENDING', attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM notifications
    WHERE status = 'PENDING' AND next_attempt_at <= now()
    ORDER BY next_attempt_at
    LIMIT 10
    FOR UPDATE SKIP LOCKED)
  RETURNING id)
SELECT id FROM claimed;

-- 9) Notificaciones fallidas para soporte -> ix_notifications_failed
SELECT n.created_at, wo.code, n.type, n.recipient_email, n.last_error
FROM notifications n JOIN work_orders wo ON wo.id = n.work_order_id
WHERE n.status = 'FAILED' ORDER BY n.created_at DESC;

-- 10) Tiempo promedio de reparación (ingreso -> entrega) por tipo de equipo
SELECT t.name, avg(wo.delivered_at - wo.received_at) AS tiempo_promedio, count(*)
FROM work_orders wo
JOIN equipments e ON e.id = wo.equipment_id
JOIN equipment_types t ON t.id = e.equipment_type_id
WHERE wo.status = 'ENTREGADO'
GROUP BY t.name;
