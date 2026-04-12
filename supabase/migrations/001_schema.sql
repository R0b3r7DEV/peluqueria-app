-- Servicios de la peluquería
create table services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  duration_minutes int  not null,
  price            decimal(8,2),
  active           boolean default true
);

-- Citas
create table appointments (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid references services(id),
  client_name  text not null,
  client_phone text not null,
  client_email text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text default 'pending',   -- pending | confirmed | cancelled | completed
  notes        text,
  created_at   timestamptz default now()
);

-- Horario semanal del negocio (0=Dom, 1=Lun ... 6=Sáb)
create table business_hours (
  id          uuid primary key default gen_random_uuid(),
  day_of_week int  not null unique,      -- unique necesario para upsert
  open_time   time,
  close_time  time,
  is_open     boolean default true
);

-- Días bloqueados (festivos, vacaciones)
create table blocked_dates (
  id           uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,     -- unique necesario para upsert
  reason       text,
  created_at   timestamptz default now()
);

-- Activar tiempo real en citas
alter publication supabase_realtime add table appointments;
