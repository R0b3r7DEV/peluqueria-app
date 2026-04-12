import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { startOfWeek, endOfWeek, startOfDay, endOfDay, format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

/**
 * Carga y sincroniza en tiempo real las citas de un rango de fechas.
 *
 * FIX — date stability: el parámetro `date` se convierte a string "yyyy-MM-dd"
 * para la comparación en useEffect. Así, pasar `new Date()` como default NO
 * crea un nuevo objeto en cada render y el canal Realtime no se re-crea en loop.
 *
 * @param {'day'|'week'} range
 * @param {Date|null}    date   — fecha de referencia; null = hoy
 */
export function useAppointments(range = 'week', date = null) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  // Estabilizar la fecha: convertir a string para usar como dep de useEffect.
  // Así, incluso si el llamador pasa `new Date()` cada render, el efecto solo
  // se re-ejecuta cuando cambia el DÍA real, no la referencia del objeto.
  const dateKey = useMemo(
    () => format(date ?? new Date(), 'yyyy-MM-dd'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date ? format(date, 'yyyy-MM-dd') : null]
  )

  // Ref con los parámetros actuales para que fetchAppointments y los handlers
  // de Realtime siempre vean los valores más recientes sin re-crearse.
  const paramsRef = useRef({ range, dateKey })
  useEffect(() => {
    paramsRef.current = { range, dateKey }
  }, [range, dateKey])

  // ------------------------------------------------------------------
  // Rango de fechas
  // ------------------------------------------------------------------
  const getRange = useCallback((r, dk) => {
    const d = new Date(dk + 'T12:00:00') // mediodía para evitar off-by-one de TZ
    if (r === 'day') {
      return { from: startOfDay(d).toISOString(), to: endOfDay(d).toISOString() }
    }
    return {
      from: startOfWeek(d, { weekStartsOn: 1 }).toISOString(),
      to:   endOfWeek(d,   { weekStartsOn: 1 }).toISOString(),
    }
  }, [])

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { from, to } = getRange(paramsRef.current.range, paramsRef.current.dateKey)

    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select('*, services (id, name, duration_minutes, price)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .order('starts_at', { ascending: true })

    if (fetchError) {
      const msg = 'No se pudieron cargar las citas. Verificá tu conexión.'
      setError(msg)
      toast.error(msg)
    } else {
      setAppointments(data ?? [])
    }

    setLoading(false)
  }, [getRange])

  // ------------------------------------------------------------------
  // Handlers Realtime
  // ------------------------------------------------------------------
  const handleInsert = useCallback((newRow) => {
    const { from, to } = getRange(paramsRef.current.range, paramsRef.current.dateKey)
    if (newRow.starts_at >= from && newRow.starts_at <= to) {
      setAppointments((prev) => {
        if (prev.some((a) => a.id === newRow.id)) return prev
        const next = [...prev, newRow]
        next.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        return next
      })
    }
  }, [getRange])

  const handleUpdate = useCallback(async (updatedRow) => {
    const { data } = await supabase
      .from('appointments')
      .select('*, services (id, name, duration_minutes, price)')
      .eq('id', updatedRow.id)
      .single()

    if (data) {
      setAppointments((prev) => prev.map((a) => (a.id === data.id ? data : a)))
    }
  }, [])

  const handleDelete = useCallback((oldRow) => {
    setAppointments((prev) => prev.filter((a) => a.id !== oldRow.id))
  }, [])

  // ------------------------------------------------------------------
  // useEffect: carga + suscripción Realtime + cleanup
  // ------------------------------------------------------------------
  useEffect(() => {
    fetchAppointments()

    const channelName = `appointments-rt-${range}-${dateKey}`

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' },
        (p) => handleInsert(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (p) => handleUpdate(p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'appointments' },
        (p) => handleDelete(p.old))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          const msg = 'Se perdió la conexión en tiempo real. Recargá la página si las citas no se actualizan.'
          setError(msg)
          toast.error(msg, { duration: 6000 })
        }
        if (status === 'TIMED_OUT') {
          toast.error('Tiempo de espera agotado. Reintentando conexión...', { duration: 4000 })
        }
      })

    return () => { supabase.removeChannel(channel) }

  // dateKey (string) es estable — solo cambia cuando cambia el DÍA real.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, dateKey])

  return { appointments, loading, error, refetch: fetchAppointments }
}
