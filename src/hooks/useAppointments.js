import { useState, useEffect, useCallback, useRef } from 'react'
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  parseISO,
} from 'date-fns'
import { supabase } from '../lib/supabase'

/**
 * Carga y sincroniza en tiempo real las citas de un rango de fechas.
 *
 * @param {'day'|'week'} range - Rango inicial a cargar al montar. Default: 'week'
 * @param {Date}         date  - Fecha de referencia. Default: hoy
 *
 * @returns {{
 *   appointments: Array,
 *   loading: boolean,
 *   error: string|null,
 *   refetch: () => Promise<void>
 * }}
 */
export function useAppointments(range = 'week', date = new Date()) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Guardar los últimos parámetros para que refetch siempre use los actuales
  const paramsRef = useRef({ range, date })
  useEffect(() => { paramsRef.current = { range, date } }, [range, date])

  // ------------------------------------------------------------------
  // Rango de fechas a consultar
  // ------------------------------------------------------------------
  const getRange = useCallback((r, d) => {
    if (r === 'day') {
      return {
        from: startOfDay(d).toISOString(),
        to:   endOfDay(d).toISOString(),
      }
    }
    // 'week' — semana comenzando el lunes
    return {
      from: startOfWeek(d, { weekStartsOn: 1 }).toISOString(),
      to:   endOfWeek(d,   { weekStartsOn: 1 }).toISOString(),
    }
  }, [])

  // ------------------------------------------------------------------
  // Fetch inicial (y refetch manual)
  // ------------------------------------------------------------------
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { from, to } = getRange(paramsRef.current.range, paramsRef.current.date)

    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        services (id, name, duration, price)
      `)
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setAppointments(data ?? [])
    }

    setLoading(false)
  }, [getRange])

  // ------------------------------------------------------------------
  // Handlers de Realtime
  // ------------------------------------------------------------------

  /**
   * INSERT: agrega la cita solo si cae dentro del rango actualmente cargado.
   * Evita mostrar citas de otros días/semanas.
   */
  const handleInsert = useCallback((newRow) => {
    const { from, to } = getRange(paramsRef.current.range, paramsRef.current.date)
    const startTime = newRow.start_time

    if (startTime >= from && startTime <= to) {
      setAppointments((prev) => {
        // Deduplicar por si el INSERT ya vino del optimistic update
        const exists = prev.some((a) => a.id === newRow.id)
        if (exists) return prev
        // Insertar en orden cronológico
        const next = [...prev, newRow]
        next.sort((a, b) => a.start_time.localeCompare(b.start_time))
        return next
      })
    }
  }, [getRange])

  /**
   * UPDATE: reemplaza el registro en el estado local.
   * Payload.new tiene los campos de la fila pero SIN joins,
   * así que hacemos un fetch selectivo solo de esa fila para
   * conservar el objeto `services` anidado.
   */
  const handleUpdate = useCallback(async (updatedRow) => {
    const { data } = await supabase
      .from('appointments')
      .select(`*, services (id, name, duration, price)`)
      .eq('id', updatedRow.id)
      .single()

    if (!data) return

    setAppointments((prev) =>
      prev.map((a) => (a.id === data.id ? data : a))
    )
  }, [])

  /**
   * DELETE: elimina la cita del estado local.
   */
  const handleDelete = useCallback((oldRow) => {
    setAppointments((prev) => prev.filter((a) => a.id !== oldRow.id))
  }, [])

  // ------------------------------------------------------------------
  // useEffect: carga inicial + suscripción Realtime + cleanup
  // ------------------------------------------------------------------
  useEffect(() => {
    fetchAppointments()

    // Canal único por instancia del hook
    const channelName = `appointments-realtime-${Date.now()}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'appointments',
        },
        (payload) => handleInsert(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'appointments',
        },
        (payload) => handleUpdate(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'appointments',
        },
        (payload) => handleDelete(payload.old)
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Error en la conexión en tiempo real')
        }
      })

    // Cleanup: desuscribir al desmontar o cuando cambian range/date
    return () => {
      supabase.removeChannel(channel)
    }
  }, [range, date, fetchAppointments, handleInsert, handleUpdate, handleDelete])

  // ------------------------------------------------------------------
  return { appointments, loading, error, refetch: fetchAppointments }
}
