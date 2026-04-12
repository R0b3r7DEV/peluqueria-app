import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { format, parseISO, addMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { supabase, updateAppointmentStatus } from '../lib/supabase'
import { useAppointments } from '../hooks/useAppointments'

moment.locale('es')
const localizer = momentLocalizer(moment)

// ─── Brand ───────────────────────────────────────────────────────────────────
const B  = '#1a4a42'
const BH = '#14372f'
const BL = '#e8f0ef'

// ─── Constants ───────────────────────────────────────────────────────────────
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const STATUS_META = {
  pending:   { label: 'Pendiente',   bg: 'bg-yellow-100', text: 'text-yellow-800', dot: '#f59e0b' },
  confirmed: { label: 'Confirmado',  bg: 'bg-green-100',  text: 'text-green-800',  dot: '#22c55e' },
  cancelled: { label: 'Cancelado',   bg: 'bg-red-100',    text: 'text-red-700',    dot: '#ef4444' },
  completed: { label: 'Completado',  bg: 'bg-gray-100',   text: 'text-gray-700',   dot: '#6b7280' },
}

const CAL_MESSAGES = {
  today: 'Hoy', previous: '←', next: '→',
  month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda',
  date: 'Fecha', time: 'Hora', event: 'Cita',
  noEventsInRange: 'Sin citas en este período.',
  showMore: (n) => `+${n} más`,
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 rounded-full border-4 animate-spin"
      style={{ borderColor: `${B}25`, borderTopColor: B }} />
  </div>
)

const Badge = ({ status }) => {
  const m = STATUS_META[status] ?? STATUS_META.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  )
}

// ─── Modal overlay ────────────────────────────────────────────────────────────
function Modal({ onClose, children, title }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Citas
// ─────────────────────────────────────────────────────────────────────────────
function TabCitas() {
  const { appointments, loading } = useAppointments('week')
  const [selected, setSelected] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [calView, setCalView] = useState('week')

  const events = useMemo(() => appointments.map((apt) => ({
    id:       apt.id,
    title:    `${apt.client_name}${apt.services ? ` · ${apt.services.name}` : ''}`,
    start:    new Date(apt.starts_at),
    end:      apt.ends_at
      ? new Date(apt.ends_at)
      : addMinutes(new Date(apt.starts_at), apt.services?.duration_minutes ?? 30),
    resource: apt,
  })), [appointments])

  const eventStyleGetter = useCallback((event) => {
    const s = event.resource.status
    const colors = {
      pending:   { background: '#fef3c7', border: '#f59e0b', color: '#92400e' },
      confirmed: { background: '#dcfce7', border: '#22c55e', color: '#14532d' },
      cancelled: { background: '#fee2e2', border: '#ef4444', color: '#7f1d1d' },
      completed: { background: '#f3f4f6', border: '#9ca3af', color: '#374151' },
    }
    const c = colors[s] ?? colors.pending
    return {
      style: {
        backgroundColor: c.background,
        borderLeft: `3px solid ${c.border}`,
        color: c.color,
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        padding: '2px 6px',
      },
    }
  }, [])

  const handleAction = async (id, status) => {
    setUpdating(true)
    try {
      await updateAppointmentStatus(id, status)
      toast.success(
        status === 'confirmed' ? 'Cita confirmada' :
        status === 'cancelled' ? 'Cita cancelada'  : 'Cita completada'
      )
      setSelected(null)
    } catch {
      toast.error('No se pudo actualizar la cita')
    } finally {
      setUpdating(false)
    }
  }

  // Stats rápidas
  const stats = useMemo(() => [
    { label: 'Esta semana',  value: appointments.length,                                   color: B },
    { label: 'Pendientes',   value: appointments.filter(a => a.status === 'pending').length,   color: '#f59e0b' },
    { label: 'Confirmadas',  value: appointments.filter(a => a.status === 'confirmed').length, color: '#22c55e' },
    { label: 'Canceladas',   value: appointments.filter(a => a.status === 'cancelled').length, color: '#ef4444' },
  ], [appointments])

  return (
    <div className="space-y-5">

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
            <span className="text-sm text-gray-500 leading-tight">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ height: 620 }}>
        {loading ? <Spinner /> : (
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            messages={CAL_MESSAGES}
            view={calView}
            onView={setCalView}
            views={['week', 'day', 'agenda']}
            defaultView="week"
            min={new Date(0, 0, 0, 8, 0)}
            max={new Date(0, 0, 0, 20, 0)}
            selectable
            onSelectEvent={(ev) => setSelected(ev.resource)}
            eventPropGetter={eventStyleGetter}
            style={{ height: '100%' }}
          />
        )}
      </div>

      {/* Appointment detail modal */}
      {selected && (
        <Modal title="Detalle de la cita" onClose={() => setSelected(null)}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 text-lg leading-tight">{selected.client_name}</p>
                {selected.client_phone && (
                  <a href={`tel:${selected.client_phone}`}
                    className="text-sm text-gray-500 hover:underline mt-0.5 block">
                    {selected.client_phone}
                  </a>
                )}
                {selected.client_email && (
                  <a href={`mailto:${selected.client_email}`}
                    className="text-sm text-gray-500 hover:underline block">
                    {selected.client_email}
                  </a>
                )}
              </div>
              <Badge status={selected.status} />
            </div>

            {/* Info grid */}
            <div className="rounded-xl divide-y divide-gray-100" style={{ background: BL }}>
              {[
                { label: 'Servicio',  value: selected.services?.name ?? '—' },
                { label: 'Duración',  value: selected.services ? `${selected.services.duration_minutes} min` : '—' },
                { label: 'Precio',    value: selected.services ? `${Number(selected.services.price).toLocaleString('es-ES')} €` : '—' },
                { label: 'Fecha',     value: format(new Date(selected.starts_at), "EEEE d 'de' MMMM yyyy", { locale: es }) },
                { label: 'Hora',      value: format(new Date(selected.starts_at), 'HH:mm', { locale: es }) + ' h' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800 capitalize text-right max-w-[60%]">{value}</span>
                </div>
              ))}
              {selected.notes && (
                <div className="px-4 py-2.5 text-sm">
                  <p className="text-gray-500 mb-1">Notas</p>
                  <p className="text-gray-700 italic">{selected.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {selected.status !== 'cancelled' && selected.status !== 'completed' && (
              <div className="flex flex-col gap-2 pt-1">
                {selected.status === 'pending' && (
                  <button disabled={updating} onClick={() => handleAction(selected.id, 'confirmed')}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: '#22c55e' }}>
                    Confirmar cita
                  </button>
                )}
                <button disabled={updating} onClick={() => handleAction(selected.id, 'completed')}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: BL, color: B }}>
                  Marcar como completada
                </button>
                <button disabled={updating} onClick={() => handleAction(selected.id, 'cancelled')}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50">
                  Cancelar cita
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — Horarios
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_HOURS = DAYS_ES.map((name, i) => ({
  day_of_week: i,
  name,
  is_open:     i >= 1 && i <= 6,   // lun-sáb
  open:        '09:00',
  close:       '18:00',
}))

function TabHorarios() {
  const [hours, setHours]           = useState(DEFAULT_HOURS)
  const [savingHours, setSavingHours] = useState(false)

  const [blocked, setBlocked]       = useState([])
  const [blockFrom, setBlockFrom]   = useState('')
  const [blockTo, setBlockTo]       = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  const [loadingBlocked, setLoadingBlocked] = useState(true)

  // Load business_hours
  useEffect(() => {
    supabase.from('business_hours').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setHours(
          DAYS_ES.map((name, i) => {
            const row = data.find((r) => r.day_of_week === i)
            return row
              ? { day_of_week: i, name, is_open: row.is_open, open: (row.open_time ?? '09:00:00').slice(0,5), close: (row.close_time ?? '18:00:00').slice(0,5) }
              : { day_of_week: i, name, is_open: i >= 1 && i <= 6, open: '09:00', close: '18:00' }
          })
        )
      }
    })
  }, [])

  // Load blocked_dates
  useEffect(() => {
    supabase.from('blocked_dates').select('*').order('blocked_date').then(({ data }) => {
      setBlocked(data ?? [])
      setLoadingBlocked(false)
    })
  }, [])

  const updateDay = (i, field, value) =>
    setHours((prev) => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))

  const saveHours = async () => {
    setSavingHours(true)
    try {
      const upsertData = hours.map(({ day_of_week, is_open, open, close }) =>
        ({ day_of_week, is_open, open_time: open, close_time: close })
      )
      const { error } = await supabase.from('business_hours').upsert(upsertData, { onConflict: 'day_of_week' })
      if (error) throw error
      toast.success('Horarios guardados')
    } catch (e) {
      toast.error(e.message ?? 'Error al guardar')
    } finally {
      setSavingHours(false)
    }
  }

  const addBlockedDate = async () => {
    if (!blockFrom) { toast.error('Seleccioná una fecha'); return }
    setSavingBlock(true)
    try {
      const rows = []
      const from = new Date(blockFrom + 'T00:00:00')
      const to   = blockTo ? new Date(blockTo + 'T00:00:00') : from
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        rows.push({ blocked_date: format(new Date(d), 'yyyy-MM-dd'), reason: blockReason || null })
      }
      const { data, error } = await supabase
        .from('blocked_dates').upsert(rows, { onConflict: 'blocked_date' }).select()
      if (error) throw error
      setBlocked((prev) => {
        const map = new Map(prev.map((b) => [b.blocked_date, b]))
        data.forEach((r) => map.set(r.blocked_date, r))
        return Array.from(map.values()).sort((a, b) => a.blocked_date.localeCompare(b.blocked_date))
      })
      setBlockFrom(''); setBlockTo(''); setBlockReason('')
      toast.success(`${rows.length} día${rows.length > 1 ? 's' : ''} bloqueado${rows.length > 1 ? 's' : ''}`)
    } catch (e) {
      toast.error(e.message ?? 'Error al bloquear')
    } finally {
      setSavingBlock(false)
    }
  }

  const removeBlockedDate = async (date) => {
    const { error } = await supabase.from('blocked_dates').delete().eq('blocked_date', date)
    if (error) { toast.error('No se pudo eliminar'); return }
    setBlocked((prev) => prev.filter((b) => b.blocked_date !== date))
    toast.success('Día desbloqueado')
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-6">

      {/* ── Horarios por día ── */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Horario de atención</h3>
            <p className="text-xs text-gray-400 mt-0.5">Configurá los días y horarios de apertura</p>
          </div>
          <button onClick={saveHours} disabled={savingHours}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 shrink-0"
            style={{ background: B }}
            onMouseEnter={(e) => { if (!savingHours) e.currentTarget.style.background = BH }}
            onMouseLeave={(e) => { if (!savingHours) e.currentTarget.style.background = B }}>
            {savingHours ? 'Guardando...' : 'Guardar horarios'}
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {hours.map((day, i) => (
            <div key={day.day_of_week}
              className={`flex flex-wrap items-center gap-4 px-6 py-3.5 transition-colors ${!day.is_open ? 'opacity-50' : ''}`}>
              {/* Toggle */}
              <button
                onClick={() => updateDay(i, 'is_open', !day.is_open)}
                className="relative w-10 h-5.5 rounded-full transition-colors shrink-0 focus:outline-none"
                style={{
                  background: day.is_open ? B : '#d1d5db',
                  width: 40, height: 22,
                }}
                aria-label={day.is_open ? 'Cerrar' : 'Abrir'}>
                <span className="absolute top-0.5 rounded-full bg-white shadow transition-all"
                  style={{ width: 18, height: 18, left: day.is_open ? 20 : 2 }} />
              </button>

              {/* Nombre día */}
              <span className="w-24 text-sm font-medium text-gray-700 shrink-0">{day.name}</span>

              {day.is_open ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" value={day.open}
                    onChange={(e) => updateDay(i, 'open', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 w-28"
                    style={{ '--tw-ring-color': B + '40' }} />
                  <span className="text-gray-400 text-sm">—</span>
                  <input type="time" value={day.close}
                    onChange={(e) => updateDay(i, 'close', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 w-28"
                    style={{ '--tw-ring-color': B + '40' }} />
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">Cerrado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Días bloqueados ── */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Días bloqueados</h3>
          <p className="text-xs text-gray-400 mt-0.5">Feriados, vacaciones o cualquier día sin atención</p>
        </div>

        {/* Form nuevo bloqueo */}
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input type="date" value={blockFrom} min={today}
                onChange={(e) => setBlockFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': B + '40' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta (opcional)</label>
              <input type="date" value={blockTo} min={blockFrom || today}
                onChange={(e) => setBlockTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': B + '40' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (opcional)</label>
              <input type="text" value={blockReason} placeholder="Ej: Feriado, Vacaciones"
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': B + '40' }} />
            </div>
            <div className="flex items-end">
              <button onClick={addBlockedDate} disabled={savingBlock}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: B }}>
                {savingBlock ? 'Bloqueando...' : '+ Bloquear días'}
              </button>
            </div>
          </div>
        </div>

        {/* Lista de bloqueos */}
        <div className="divide-y divide-gray-50">
          {loadingBlocked ? (
            <div className="px-6 py-8"><Spinner /></div>
          ) : blocked.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No hay días bloqueados</p>
          ) : (
            blocked.map((b) => (
              <div key={b.blocked_date} className="flex items-center justify-between px-6 py-3 gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: BL, color: B }}>
                    {format(parseISO(b.blocked_date), 'dd')}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {format(parseISO(b.blocked_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </p>
                    {b.reason && <p className="text-xs text-gray-400">{b.reason}</p>}
                  </div>
                </div>
                <button onClick={() => removeBlockedDate(b.blocked_date)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 shrink-0"
                  aria-label="Eliminar bloqueo">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Servicios
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_SERVICE = { name: '', duration: 30, price: '' }

function TabServicios() {
  const [services, setServices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_SERVICE)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState(null)

  const loadServices = useCallback(async () => {
    const { data } = await supabase.from('services').select('*').order('name')
    setServices(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadServices() }, [loadServices])

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const openNew = () => { setForm(EMPTY_SERVICE); setEditId(null); setShowForm(true) }
  const openEdit = (s) => {
    setForm({ name: s.name, duration: s.duration_minutes, price: s.price })
    setEditId(s.id)
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.price) { toast.error('Completa el nombre y el precio'); return }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), duration_minutes: Number(form.duration), price: Number(form.price) }
      if (editId) {
        const { error } = await supabase.from('services').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Servicio actualizado')
      } else {
        const { error } = await supabase.from('services').insert([{ ...payload, active: true }])
        if (error) throw error
        toast.success('Servicio creado')
      }
      setShowForm(false)
      loadServices()
    } catch (err) {
      toast.error(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id, current) => {
    const { error } = await supabase.from('services').update({ active: !current }).eq('id', id)
    if (error) { toast.error('No se pudo actualizar'); return }
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, active: !current } : s))
  }

  const deleteService = async (id) => {
    if (!window.confirm('¿Eliminar este servicio? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) { toast.error('No se pudo eliminar'); return }
    setServices((prev) => prev.filter((s) => s.id !== id))
    toast.success('Servicio eliminado')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Servicios</h3>
          <p className="text-xs text-gray-400 mt-0.5">{services.length} servicio{services.length !== 1 ? 's' : ''} registrado{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: B }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BH)}
          onMouseLeave={(e) => (e.currentTarget.style.background = B)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo servicio
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? <Spinner /> : services.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No hay servicios. Creá el primero.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-12 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span className="col-span-5">Servicio</span>
              <span className="col-span-2 text-center">Duración</span>
              <span className="col-span-2 text-center">Precio</span>
              <span className="col-span-2 text-center">Estado</span>
              <span className="col-span-1" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {services.map((s) => (
                <div key={s.id}
                  className={`grid grid-cols-2 sm:grid-cols-12 items-center px-6 py-4 gap-2 transition-colors hover:bg-gray-50/50 ${!s.active ? 'opacity-50' : ''}`}>

                  {/* Name */}
                  <div className="col-span-2 sm:col-span-5">
                    <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                    <p className="text-xs text-gray-400 sm:hidden">{s.duration_minutes} min · {Number(s.price).toLocaleString('es-ES')} €</p>
                  </div>

                  <p className="hidden sm:block sm:col-span-2 text-center text-sm text-gray-600">{s.duration_minutes} min</p>
                  <p className="hidden sm:block sm:col-span-2 text-center text-sm font-semibold" style={{ color: B }}>
                    {Number(s.price).toLocaleString('es-ES')} €
                  </p>

                  {/* Toggle active */}
                  <div className="sm:col-span-2 flex justify-end sm:justify-center">
                    <button
                      onClick={() => toggleActive(s.id, s.active)}
                      className="relative rounded-full focus:outline-none"
                      style={{ width: 40, height: 22 }}
                      aria-label={s.active ? 'Desactivar' : 'Activar'}>
                      <span className="absolute inset-0 rounded-full transition-colors"
                        style={{ background: s.active ? B : '#d1d5db' }} />
                      <span className="absolute top-0.5 rounded-full bg-white shadow transition-all"
                        style={{ width: 18, height: 18, left: s.active ? 20 : 2 }} />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="sm:col-span-1 flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      aria-label="Editar">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteService(s.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Eliminar">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <Modal title={editId ? 'Editar servicio' : 'Nuevo servicio'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            {[
              { id: 'name',     label: 'Nombre',           type: 'text',   placeholder: 'Ej: Corte de cabello' },
              { id: 'duration', label: 'Duración (min)',    type: 'number', placeholder: '30', min: 5,    step: 5 },
              { id: 'price',    label: 'Precio (€)',        type: 'number', placeholder: '25', min: 0 },
            ].map(({ id, label, ...inputProps }) => (
              <div key={id}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {label} <span className="text-red-400">*</span>
                </label>
                <input {...inputProps} value={form[id]} onChange={set(id)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': B + '40' }} />
              </div>
            ))}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: B }}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav
// ─────────────────────────────────────────────────────────────────────────────
const NAV_TABS = [
  {
    id: 'citas', label: 'Citas',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    id: 'horarios', label: 'Horarios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    id: 'servicios', label: 'Servicios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminPage
// ─────────────────────────────────────────────────────────────────────────────
export function AdminPage() {
  const navigate         = useNavigate()
  const [user, setUser]  = useState(null)
  const [tab, setTab]    = useState('citas')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const salonName = import.meta.env.VITE_SALON_NAME ?? 'Mi Peluquería'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  // Initials for avatar
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121
                   m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0
                   10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm truncate">{salonName}</p>
            <p className="text-white/50 text-xs">Panel de administración</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_TABS.map((t) => {
          const active = tab === t.id
          return (
            <button key={t.id}
              onClick={() => { setTab(t.id); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
              style={{
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
              }}>
              <span style={{ opacity: active ? 1 : 0.7 }}>{t.icon}</span>
              {t.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-white text-xs font-medium truncate">{user?.email ?? '—'}</p>
            <p className="text-white/40 text-xs">Administrador</p>
          </div>
          <button onClick={handleLogout}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-lg"
            title="Cerrar sesión" aria-label="Cerrar sesión">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f7faf9' }}>

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-full"
        style={{ background: B }}>
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col"
            style={{ background: B }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger mobile */}
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-semibold text-gray-900">
              {NAV_TABS.find((t) => t.id === tab)?.label}
            </h1>
          </div>

          {/* Mobile user avatar */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: B }}>
              {initials}
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
          {tab === 'citas'     && <TabCitas />}
          {tab === 'horarios'  && <TabHorarios />}
          {tab === 'servicios' && <TabServicios />}
        </main>
      </div>
    </div>
  )
}
