import { createClient } from '@supabase/supabase-js'
import {
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  addMinutes,
  isWithinInterval,
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
 * Si existe la tabla `business_hours` en Supabase la usa;
 * si no, retorna los valores por defecto hardcodeados.
 *
 * @returns {Promise<{ open: string, close: string, slotMinutes: number, workDays: number[] }>}
 *   open/close en formato "HH:mm", workDays = índices JS (0=Dom, 1=Lun, …)
 */
export async function getBusinessHours() {
  const { data, error } = await supabase
    .from('business_hours')
    .select('*')
    .single()

  if (error || !data) {
    // Valores por defecto: lunes a sábado, 9-18 h, turnos de 30 min
    return {
      open: '09:00',
      close: '18:00',
      slotMinutes: 30,
      workDays: [1, 2, 3, 4, 5, 6],
    }
  }

  return {
    open: data.open,
    close: data.close,
    slotMinutes: data.slot_minutes ?? 30,
    workDays: data.work_days ?? [1, 2, 3, 4, 5, 6],
  }
}

// ---------------------------------------------------------------------------
// Blocked dates
// ---------------------------------------------------------------------------

/**
 * Devuelve las fechas bloqueadas (feriados, vacaciones, etc.).
 * Cada elemento es un string "YYYY-MM-DD".
 *
 * @returns {Promise<string[]>}
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
 * Devuelve todos los turnos de un día dado, incluyendo datos del servicio.
 *
 * @param {Date|string} date
 * @returns {Promise<Array>}
 */
export async function getAppointments(date) {
  const day = typeof date === 'string' ? parseISO(date) : date
  const from = startOfDay(day).toISOString()
  const to = endOfDay(day).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      services (id, name, duration, price)
    `)
    .gte('start_time', from)
    .lte('start_time', to)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Crea un nuevo turno.
 *
 * @param {{ client_name: string, client_phone?: string, service_id: string, start_time: string, notes?: string }} appointmentData
 * @returns {Promise<Object>} El turno creado
 */
export async function createAppointment(appointmentData) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ ...appointmentData, status: 'pending' }])
    .select(`*, services (id, name, duration, price)`)
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Actualiza el estado de un turno.
 *
 * @param {string} id  UUID del turno
 * @param {'pending'|'confirmed'|'cancelled'|'completed'} status
 * @returns {Promise<Object>} El turno actualizado
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
 * Algoritmo:
 *  1. Obtiene horarios del negocio y duración del servicio.
 *  2. Genera todos los slots posibles del día (de `open` a `close - duration`).
 *  3. Descarta slots que se solapan con turnos ya reservados.
 *  4. Descarta slots en el pasado.
 *  5. Retorna array de objetos { start: Date, end: Date, label: string }.
 *
 * @param {Date|string} date
 * @param {string} serviceId  UUID del servicio
 * @returns {Promise<Array<{ start: Date, end: Date, label: string }>>}
 */
export async function getAvailableSlots(date, serviceId) {
  const day = typeof date === 'string' ? parseISO(date) : date

  // 1. Configuracion del negocio + duración del servicio (en paralelo)
  const [hours, serviceResult, blockedDates, existingAppointments] =
    await Promise.all([
      getBusinessHours(),
      supabase.from('services').select('duration').eq('id', serviceId).single(),
      getBlockedDates(),
      getAppointments(day),
    ])

  // Dia bloqueado o fuera de días laborables
  const dateStr = format(day, 'yyyy-MM-dd')
  const dayOfWeek = day.getDay()
  if (
    blockedDates.includes(dateStr) ||
    !hours.workDays.includes(dayOfWeek)
  ) {
    return []
  }

  if (serviceResult.error || !serviceResult.data) {
    throw new Error('Servicio no encontrado')
  }

  const serviceDuration = serviceResult.data.duration // minutos
  const slotSize = hours.slotMinutes

  // 2. Generar todos los slots del día
  const [openH, openM] = hours.open.split(':').map(Number)
  const [closeH, closeM] = hours.close.split(':').map(Number)

  const dayStart = setMinutes(setHours(day, openH), openM)
  const dayEnd = setMinutes(setHours(day, closeH), closeM)
  const now = new Date()

  const slots = []
  let cursor = dayStart

  while (addMinutes(cursor, serviceDuration) <= dayEnd) {
    const slotStart = cursor
    const slotEnd = addMinutes(cursor, serviceDuration)

    // 4. Descartar pasados
    if (slotStart > now) {
      // 3. Verificar solapamiento con turnos existentes
      const overlaps = existingAppointments.some((apt) => {
        const aptStart = parseISO(apt.start_time)
        const aptEnd = apt.end_time
          ? parseISO(apt.end_time)
          : addMinutes(aptStart, apt.services?.duration ?? slotSize)

        return slotStart < aptEnd && slotEnd > aptStart
      })

      if (!overlaps) {
        slots.push({
          start: slotStart,
          end: slotEnd,
          label: format(slotStart, 'HH:mm'),
        })
      }
    }

    cursor = addMinutes(cursor, slotSize)
  }

  return slots
}
