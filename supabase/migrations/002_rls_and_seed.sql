-- ============================================================================
-- 002_rls_and_seed.sql
-- Row Level Security, access policies and initial seed data.
-- Run after 001_schema.sql and 001_add_cancellation_token.sql.
-- ============================================================================

-- ─── Enable Row Level Security on every table ───────────────────────────────
-- Without RLS, anyone holding the public `anon` key can read and write freely.
alter table services       enable row level security;
alter table business_hours enable row level security;
alter table blocked_dates  enable row level security;
alter table appointments   enable row level security;

-- ─── Public (anon) access — required by the public booking flow ─────────────
-- The customer-facing booking page has no login, so the anon key must be able
-- to read the catalog and schedule, and create appointments.
create policy "public read services"       on services       for select using (true);
create policy "public read business_hours" on business_hours for select using (true);
create policy "public read blocked_dates"  on blocked_dates  for select using (true);

create policy "public create appointments" on appointments   for insert with check (true);

-- The booking page also reads existing appointments to compute free time slots,
-- and reads the row back right after inserting it.
-- NOTE (production hardening): `using (true)` exposes ALL appointment columns
-- (including client name/phone) to the anon key. To avoid leaking PII, expose
-- only start/end times via a dedicated view or RPC and drop this select policy.
create policy "public read appointments"   on appointments   for select using (true);

-- ─── Admin (authenticated) access — the /admin panel ────────────────────────
-- Signed-in staff manage everything.
create policy "auth manage services"       on services       for all to authenticated using (true) with check (true);
create policy "auth manage business_hours" on business_hours for all to authenticated using (true) with check (true);
create policy "auth manage blocked_dates"  on blocked_dates  for all to authenticated using (true) with check (true);
create policy "auth manage appointments"   on appointments   for all to authenticated using (true) with check (true);

-- ─── Seed: sample services (only if the table is still empty) ───────────────
insert into services (name, duration_minutes, price, active)
select v.name, v.duration_minutes, v.price, v.active
from (values
  ('Corte de caballero',        30, 12.00, true),
  ('Corte de señora',           45, 18.00, true),
  ('Corte + lavado + peinado',  60, 25.00, true),
  ('Tinte',                     90, 45.00, true),
  ('Mechas',                   120, 60.00, true),
  ('Arreglo de barba',          20,  8.00, true)
) as v(name, duration_minutes, price, active)
where not exists (select 1 from services);

-- ─── Seed: default weekly hours (Mon–Sat 09:00–20:00, Sun closed) ──────────
insert into business_hours (day_of_week, open_time, close_time, is_open) values
  (0, null,   null,   false),
  (1, '09:00','20:00', true),
  (2, '09:00','20:00', true),
  (3, '09:00','20:00', true),
  (4, '09:00','20:00', true),
  (5, '09:00','20:00', true),
  (6, '09:00','14:00', true)
on conflict (day_of_week) do nothing;
