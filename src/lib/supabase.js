import { createClient } from '@supabase/supabase-js'
import {
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  addMinutes,
  parseISO,
  format,
} from 'date-fns'

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tamaño de slot por defecto (minutos) — la tabla no tiene esta columna
const DEFAULT_SLOT = 30

// ---------------------------------------------------------------------------
// Business hours  (columnas: day_of_week, open_time, close_time, is_open)
// ---------------------------------------------------------------------------
export async function getBusinessHours() {
  const DEFAULTS = {
    workDays: [1, 2, 3, 4, 5, 6],
    schedule: Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => [
        d,
        { open: '09:00', close: '18:00', slotMinutes: DEFAULT_SLOT, isOpen: d >= 1 && d <= 6 },
      ])
    ),
  }

  const { data, error } = await supabase
    .from('business_hours')
    .select('*')
    .order('day_of_week')

  if (error || !data || data.length === 0) return DEFAULTS

  const workDays = data.filter((r) => r.is_open).map((r) => r.day_of_week)
  const schedule = Object.fromEntries(
    data.map((r) => [
      r.day_of_week,
      {
        // Schema usa open_time / close_time (tipo TIME → llega como "HH:MM:SS")
        open:        (r.open_time  ?? '09:00:00').slice(0, 5),
        close:       (r.close_time ?? '18:00:00').slice(0, 5),
        slotMinutes: DEFAULT_SLOT,
        isOpen:      r.is_open ?? false,
      },
    ])
  )

  return { workDays, schedule }
}

// ---------------------------------------------------------------------------
// Blocked dates  (columna: blocked_date)
// ---------------------------------------------------------------------------
export async function getBlockedDates() {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('blocked_date')
    .order('blocked_date', { ascending: true })

  if (error || !data) return []
  return data.map((row) => row.blocked_date)
}

// ---------------------------------------------------------------------------
// Appointments  (columnas: starts_at, ends_at)
// ---------------------------------------------------------------------------

/** Citas NO canceladas de un día, con datos del servicio. */
export async function getAppointments(date) {
  const day  = typeof date === 'string' ? parseISO(date) : date
  const from = startOfDay(day).toISOString()
  const to   = endOfDay(day).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select('*, services (id, name, duration_minutes, price)')
    .gte('starts_at', from)
    .lte('starts_at', to)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

/** Crea un turno con status 'pending'. */
export async function createAppointment(appointmentData) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ ...appointmentData, status: 'pending' }])
    .select('*, services (id, name, duration_minutes, price)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Cambia el estado de un turno. */
export async function updateAppointmentStatus(id, status) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ---------------------------------------------------------------------------
// Available slots
// ---------------------------------------------------------------------------
export async function getAvailableSlots(date, serviceId) {
  const day = typeof date === 'string' ? parseISO(date) : date

  const [hours, serviceResult, blockedDates, existingAppointments] =
    await Promise.all([
      getBusinessHours(),
      supabase.from('services').select('duration_minutes').eq('id', serviceId).single(),
      getBlockedDates(),
      getAppointments(day),
    ])

  const dateStr   = format(day, 'yyyy-MM-dd')
  const dayOfWeek = day.getDay()

  if (blockedDates.includes(dateStr) || !hours.workDays.includes(dayOfWeek)) return []
  if (serviceResult.error || !serviceResult.data) throw new Error('Servicio no encontrado')

  const dayConfig       = hours.schedule[dayOfWeek] ?? { open: '09:00', close: '18:00', slotMinutes: DEFAULT_SLOT }
  const [openH,  openM] = dayConfig.open.split(':').map(Number)
  const [closeH, closeM] = dayConfig.close.split(':').map(Number)

  const serviceDuration = serviceResult.data.duration_minutes
  const slotSize        = dayConfig.slotMinutes

  const dayStart = setMinutes(setHours(day, openH), openM)
  const dayEnd   = setMinutes(setHours(day, closeH), closeM)
  const now      = new Date()

  const slots = []
  let cursor  = dayStart

  while (addMinutes(cursor, serviceDuration) <= dayEnd) {
    const slotStart = cursor
    const slotEnd   = addMinutes(cursor, serviceDuration)

    if (slotStart > now) {
      const overlaps = existingAppointments.some((apt) => {
        const aptStart = parseISO(apt.starts_at)
        const aptEnd   = apt.ends_at
          ? parseISO(apt.ends_at)
          : addMinutes(aptStart, apt.services?.duration_minutes ?? slotSize)
        return slotStart < aptEnd && slotEnd > aptStart
      })
      if (!overlaps) {
        slots.push({ start: slotStart, end: slotEnd, label: format(slotStart, 'HH:mm') })
      }
    }

    cursor = addMinutes(cursor, slotSize)
  }

  return slots
}
