-- Agrega columna para el token de cancelación y email del cliente
alter table appointments
  add column if not exists client_email       text,
  add column if not exists cancellation_token text unique;

-- Índice para buscar por token en la ruta /cancel
create index if not exists idx_appointments_cancellation_token
  on appointments (cancellation_token)
  where cancellation_token is not null;
