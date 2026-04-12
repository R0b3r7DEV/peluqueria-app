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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---------------------------------------------------------------------------
// Business hours
// ---------------------------------------------------------------------------

/**
 * Devuelve la configuración de horarios del negocio.
 *
 * La tabla `business_hours` tiene UNA FILA POR DÍA (day_of_week 0-6).
 * Retorna:
 *   - workDays: number[]  días laborables (índices JS, 0=Dom)
 *   - schedule: Record<number, { open, close, slotMinutes }>  config por día
 *
 * Si la tabla no existe o está vacía usa defaults: lun-sáb 9-18 h, 30 min.
 */
export async function getBusinessHours() {
  const DEFAULTS = {
    workDays: [1, 2, 3, 4, 5, 6],
    schedule: Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => [
        d,
        { open: '09:00', close: '18:00', slotMinutes: 30, isOpen: d >= 1 && d <= 6 },
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
        open:        r.open         ?? '09:00',
        close:       r.close        ?? '18:00',
        slotMinutes: r.slot_minutes ?? 30,
        isOpen:      r.is_open      ?? false,
      },
    ])
  )

  return { workDays, schedule }
}

// ---------------------------------------------------------------------------
// Blocked dates
// ---------------------------------------------------------------------------

/**
 * Devuelve las fechas bloqueadas como strings "YYYY-MM-DD".
 */
export async function getBlockedDates() {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('date')
    .order('date', { ascending: true })

  if (error || !data) return []
  return data.map((row) => row.date)
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

/**
 * Devuelve los turnos NO cancelados de un día, incluyendo datos del servicio.
 */
export async function getAppointments(date) {
  const day  = typeof date === 'string' ? parseISO(date) : date
  const from = startOfDay(day).toISOString()
  const to   = endOfDay(day).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select('*, services (id, name, duration, price)')
    .gte('start_time', from)
    .lte('start_time', to)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Crea un nuevo turno con status 'pending'.
 */
export async function createAppointment(appointmentData) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ ...appointmentData, status: 'pending' }])
    .select('*, services (id, name, duration, price)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Actualiza el estado de un turno.
 */
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

/**
 * Calcula los huecos libres de un día para un servicio dado.
 *
 * FIX: Ahora usa `schedule[dayOfWeek]` para obtener el horario específico
 * del día (la tabla tiene una fila por día, no una sola fila global).
 *
 * Retorna array de { start: Date, end: Date, label: string }
 */
export async function getAvailableSlots(date, serviceId) {
  const day = typeof date === 'string' ? parseISO(date) : date

  const [hours, serviceResult, blockedDates, existingAppointments] =
    await Promise.all([
      getBusinessHours(),
      supabase.from('services').select('duration').eq('id', serviceId).single(),
      getBlockedDates(),
      getAppointments(day),
    ])

  const dateStr   = format(day, 'yyyy-MM-dd')
  const dayOfWeek = day.getDay()

  // Día bloqueado o fuera de días laborables
  if (blockedDates.includes(dateStr) || !hours.workDays.includes(dayOfWeek)) {
    return []
  }

  if (serviceResult.error || !serviceResult.data) {
    throw new Error('Servicio no encontrado')
  }

  // Horario específico del día (open/close pueden diferir por día)
  const dayConfig = hours.schedule[dayOfWeek] ?? { open: '09:00', close: '18:00', slotMinutes: 30 }
  const [openH,  openM]  = dayConfig.open.split(':').map(Number)
  const [closeH, closeM] = dayConfig.close.split(':').map(Number)

  const serviceDuration = serviceResult.data.duration
  const slotSize        = dayConfig.slotMinutes

  const dayStart = setMinutes(setHours(day, openH),  openM)
  const dayEnd   = setMinutes(setHours(day, closeH), closeM)
  const now      = new Date()

  const slots  = []
  let cursor   = dayStart

  while (addMinutes(cursor, serviceDuration) <= dayEnd) {
    const slotStart = cursor
    const slotEnd   = addMinutes(cursor, serviceDuration)

    if (slotStart > now) {
      const overlaps = existingAppointments.some((apt) => {
        const aptStart = parseISO(apt.start_time)
        const aptEnd   = apt.end_time
          ? parseISO(apt.end_time)
          : addMinutes(aptStart, apt.services?.duration ?? slotSize)
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
