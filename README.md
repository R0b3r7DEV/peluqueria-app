# Salon Booking App

> Online appointment booking for hair salons and beauty studios: clients book in a few steps,
> and the owner manages appointments, opening hours and services in real time.

<p>
  <img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite_8-646CFF?style=flat&logo=vite&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_3-38BDF8?style=flat&logo=tailwindcss&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" />
  <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-blue?style=flat" />
</p>

<!-- TODO: screenshot — booking flow and admin calendar -->

*🇪🇸 A Spanish version of this document is available on request.*

---

## Features

### Client portal (`/`)
- **3-step booking flow**: pick a service → date and time → contact details.
- Monthly calendar that respects opening hours and blocked days.
- Time slots computed dynamically from service duration and existing appointments.
- Automatic confirmation email with a cancellation link.

### Admin panel (`/admin`)
- **Appointments tab** — weekly/daily calendar (react-big-calendar) with a detail modal to confirm,
  complete or cancel.
- **Hours tab** — per-weekday opening hours + blocked days (holidays, vacations).
- **Services tab** — CRUD for services (name, duration, price) with active/inactive toggle.
- **Real-time updates** via Supabase Realtime (`postgres_changes`).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS 3 |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| Calendar | react-big-calendar + moment |
| Email | Resend (Supabase Edge Function) |
| Routing | React Router DOM v7 |
| Notifications | react-hot-toast |

---

## Project structure

```
src/
├── pages/
│   ├── BookingPage.jsx     # public booking (3 steps)
│   ├── AdminPage.jsx       # admin panel (tabs + sidebar)
│   └── LoginPage.jsx       # Supabase Auth login
├── components/
│   ├── ProtectedRoute.jsx  # auth guard
│   ├── AppointmentCard.jsx
│   ├── BookingForm.jsx
│   ├── Calendar.jsx        # BigCalendar wrapper
│   └── ServiceSelector.jsx
├── hooks/useAppointments.js  # state + Realtime subscription
└── lib/supabase.js           # client + helpers (slots, hours, ...)
supabase/
├── functions/send-confirmation/  # Edge Function → Resend
└── migrations/                   # database schema
```

---

## Getting started

```bash
git clone https://github.com/R0b3r7DEV/peluqueria-app.git
cd peluqueria-app
npm install
cp .env.example .env      # set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SALON_NAME
npm run dev               # http://localhost:5173
```

**Database:** apply the SQL in `supabase/migrations/` from the Supabase SQL Editor (it creates the
`services`, `appointments`, `business_hours` and `blocked_dates` tables and enables Realtime on
`appointments`).

**Confirmation emails (optional):** deploy the `send-confirmation` Edge Function and wire a Database
Webhook on `appointments` INSERT — see the function's `.env.example` for the required secrets
(`RESEND_API_KEY`, `FROM_EMAIL`, `WEBHOOK_SECRET`, ...).

```bash
npm run build     # production build
npm run preview   # preview the build
```

---

## What I learned building this

- Modeling a **real business domain** (services, opening hours, blocked days) and computing valid
  time slots on top of it.
- Using **Supabase Realtime** so the admin calendar reflects new bookings instantly.
- Building a clean **role split**: a public booking flow and an authenticated admin area behind a
  route guard.
- Wiring **event-driven emails** with a serverless Edge Function triggered by a database webhook.

---

## License

MIT © [R0b3r7DEV](https://github.com/R0b3r7DEV)
