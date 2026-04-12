
# ✂️ Peluquería App

Sistema de reservas online para peluquerías y salones de belleza. Permite a los clientes reservar turnos en pocos pasos y a los administradores gestionar citas, horarios y servicios en tiempo real.

![Stack](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-realtime-3ecf8e?style=flat-square&logo=supabase)

---

## Funcionalidades

### 👤 Portal del cliente (`/`)
- Flujo de reserva en **3 pasos**: selección de servicio → fecha y hora → datos de contacto
- Calendario mensual que respeta horarios de apertura y días bloqueados
- Slots de horario calculados dinámicamente según duración del servicio y citas existentes
- Email de confirmación automático con enlace para cancelar

### 🔐 Panel de administración (`/admin`)
- **Tab Citas** — calendario semanal/diario con react-big-calendar; modal de detalle con acciones confirmar, completar y cancelar
- **Tab Horarios** — configuración de días y horarios de apertura por día de la semana + gestión de días bloqueados (feriados, vacaciones)
- **Tab Servicios** — ABM de servicios con nombre, duración y precio; toggle activo/inactivo
- Sidebar con avatar, nombre del negocio y cierre de sesión
- Actualizaciones en **tiempo real** vía Supabase Realtime

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Estilos | Tailwind CSS 3 |
| Backend / DB | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| Tiempo real | Supabase Realtime (postgres_changes) |
| Calendario | react-big-calendar + moment |
| Email | Resend (Edge Function) |
| Routing | React Router DOM v6 |
| Notificaciones | react-hot-toast |

---

## Estructura del proyecto

```
peluqueria-app/
├── src/
│   ├── pages/
│   │   ├── BookingPage.jsx       # Reserva pública (3 pasos)
│   │   ├── AdminPage.jsx         # Panel admin (tabs + sidebar)
│   │   └── LoginPage.jsx         # Login con Supabase Auth
│   ├── components/
│   │   ├── ProtectedRoute.jsx    # Guard de autenticación
│   │   ├── AppointmentCard.jsx   # Tarjeta de cita
│   │   ├── BookingForm.jsx       # Formulario de reserva
│   │   ├── Calendar.jsx          # Wrapper de BigCalendar
│   │   └── ServiceSelector.jsx   # Dropdown de servicios
│   ├── hooks/
│   │   └── useAppointments.js    # Estado + Realtime suscripción
│   └── lib/
│       └── supabase.js           # Cliente + helpers (slots, horarios, etc.)
├── supabase/
│   ├── functions/
│   │   └── send-confirmation/    # Edge Function → Resend
│   └── migrations/
│       └── 001_add_cancellation_token.sql
└── .env.example
```

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/R0b3r7DEV/peluqueria-app.git
cd peluqueria-app
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Editá `.env` con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_SALON_NAME=Mi Peluquería
```

### 3. Base de datos (Supabase)

Ejecutá el siguiente SQL en el **SQL Editor** de tu proyecto Supabase:

```sql
-- Servicios
create table services (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  duration int  not null,
  price    numeric not null,
  active   boolean default true
);

-- Horarios de atención
create table business_hours (
  day_of_week int  primary key,  -- 0=Dom, 1=Lun, ..., 6=Sáb
  is_open     bool default true,
  open        text default '09:00',
  close       text default '18:00',
  slot_minutes int default 30
);

-- Días bloqueados
create table blocked_dates (
  date   date primary key,
  reason text
);

-- Turnos
create table appointments (
  id                 uuid        primary key default gen_random_uuid(),
  client_name        text        not null,
  client_phone       text,
  client_email       text,
  service_id         uuid        references services(id),
  start_time         timestamptz not null,
  end_time           timestamptz,
  status             text        default 'pending',
  notes              text,
  cancellation_token text        unique,
  created_at         timestamptz default now()
);

-- Habilitar Realtime
alter publication supabase_realtime add table appointments;
```

### 4. Levantar el servidor de desarrollo

```bash
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173)

---

## Deploy de la Edge Function (emails)

```bash
# Instalar Supabase CLI
npm install -g supabase
supabase login

# Setear variables de entorno
supabase secrets set --project-ref <project-ref> \
  RESEND_API_KEY=re_xxxx \
  FROM_EMAIL=turnos@tuperluqueria.com \
  SALON_NAME="Mi Peluquería" \
  SALON_ADDRESS="Tu dirección" \
  APP_URL=https://tuperluqueria.com \
  WEBHOOK_SECRET=un-secreto-seguro

# Deploy
supabase functions deploy send-confirmation --project-ref <project-ref>
```

Luego crear el **Database Webhook** en Supabase Dashboard:
- Tabla: `appointments` — Evento: `INSERT`
- URL: `https://<project-ref>.supabase.co/functions/v1/send-confirmation`
- Header: `x-webhook-secret: <WEBHOOK_SECRET>`

---

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
```

---

## Licencia

MIT © [R0b3r7DEV](https://github.com/R0b3r7DEV)
