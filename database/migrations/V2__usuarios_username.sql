-- =============================================================================
-- V2__usuarios_username.sql
-- Objetivo: el personal inicia sesión con un NOMBRE DE USUARIO (la app es local,
-- no necesita correo). Se renombra users.email -> users.username conservando los
-- datos: los usuarios antiguos con formato de correo siguen siendo válidos.
-- SQLite >= 3.25 renombra la columna también dentro del índice; el índice se
-- recrea sólo para que su nombre refleje la columna nueva.
-- =============================================================================

ALTER TABLE users RENAME COLUMN email TO username;

DROP INDEX ux_users_email_lower;
CREATE UNIQUE INDEX ux_users_username_lower ON users (lower(username));
