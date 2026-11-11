-- =============================================================================
-- demo_data.sql
-- Objetivo: datos de demostración SOLO para entornos Dev/QA. NUNCA ejecutar en
-- producción. El usuario administrador se crea con `npm run seed` (backend)
-- porque la contraseña debe hashearse con bcrypt.
-- Uso: docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME < database/seeds/demo_data.sql
-- =============================================================================

INSERT INTO clients (full_name, document_id, email, phone, address) VALUES
  ('María Fernanda Pérez', '1718123456', 'maria.perez@example.com', '0991234567', 'Av. Amazonas N34-12, Quito'),
  ('Carlos Andrés Gómez',  '1723456789', 'carlos.gomez@example.com', '0987654321', 'Calle Bolívar 123, Quito'),
  ('Tecnología Andina S.A.', '1790012345001', 'compras@tecnoandina.example.com', '022345678', 'Parque Industrial, Quito')
ON CONFLICT DO NOTHING;
