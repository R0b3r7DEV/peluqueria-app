import { useState, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  getBusinessHours,
  getBlockedDates,
  getAvailableSlots,
  createAppointment,
  supabase,
} from '../lib/supabase'

// ─── Constants ───────────────────────────────────────────────────────────────
const STEPS      = ['Servicio', 'Fecha y hora', 'Tus datos']
const BRAND      = '#1a4a42'
const BRAND_LIGHT = '#e8f0ef'
const BRAND_HOVER = '#14372f'

// ─── Validation helpers ───────────────────────────────────────────────────────
// Acepta formatos: +54 11 1234-5678 / 011 1234-5678 / 1134567890 / etc.
const PHONE_RE = /^[+\d][\d\s\-().]{6,19}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validateClientForm(form) {
  const errors = {}

  const name = form.name.trim()
  if (!name) {
    errors.name = 'El nombre es obligatorio'
  } else if (name.length < 3) {
    errors.name = 'El nombre debe tener al menos 3 caracteres'
  }

  const phone = form.phone.trim()
  if (!phone) {
    errors.phone = 'El teléfono es obligatorio'
  } else if (!PHONE_RE.test(phone)) {
    errors.phone = 'Formato inválido. Ej: +54 11 1234-5678'
  }

  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Ingresá un email válido'
  }

  return errors
}

// ─── StepIndicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-6 sm:mb-8 select-none">
      {STEPS.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all"
                style={{ background: done || active ? BRAND : '#e5e7eb', color: done || active ? '#fff' : '#9ca3af' }}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap hidden xs:block"
                style={{ color: active ? BRAND : done ? '#6b7280' : '#9ca3af' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-8 xs:w-12 sm:w-20 h-0.5 mb-4 mx-1 transition-all"
                style={{ background: done ? BRAND : '#e5e7eb' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ServiceCard ─────────────────────────────────────────────────────────────
function ServiceCard({ service, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white border-2 border-gray-100 rounded-2xl p-4 sm:p-5 transition-all duration-200 focus:outline-none"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = BRAND)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f3f4f6')}
      onFocus={(e)      => (e.currentTarget.style.borderColor = BRAND)}
      onBlur={(e)       => (e.currentTarget.style.borderColor = '#f3f4f6')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug">{service.name}</h3>
          {service.description && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
          )}
        </div>
        <div className="shrink-0 rounded-full p-1.5 transition-transform group-hover:scale-110" style={{ background: BRAND_LIGHT }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={BRAND} strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          {service.duration} min
        </span>
        <span className="text-sm sm:text-base font-bold" style={{ color: BRAND }}>
          ${Number(service.price).toLocaleString('es-AR')}
        </span>
      </div>
    </button>
  )
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ businessHours, blockedDates, selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(new Date())
  const today = startOfDay(new Date())

  const monthStart = startOfMonth(viewMonth)
  const monthEnd   = endOfMonth(viewMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })

  const days = []
  let cursor = calStart
  while (cursor <= calEnd) { days.push(cursor); cursor = addDays(cursor, 1) }

  const isDisabled = (day) => {
    if (isBefore(day, today)) return true
    if (!isSameMonth(day, viewMonth)) return true
    const dow = day.getDay()
    // FIX: usa workDays del objeto correcto (array de días laborables)
    if (businessHours && !businessHours.workDays.includes(dow)) return true
    if (blockedDates.includes(format(day, 'yyyy-MM-dd'))) return true
    return false
  }

  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Mes anterior">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-gray-800 text-sm capitalize">
          {format(viewMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Mes siguiente">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => {
          const disabled    = isDisabled(day)
          const selected    = selectedDate && isSameDay(day, selectedDate)
          const todayFlag   = isToday(day)
          const outOfMonth  = !isSameMonth(day, viewMonth)
          return (
            <button key={idx} disabled={disabled}
              onClick={() => !disabled && onSelectDate(day)}
              className={[
                'relative w-full aspect-square rounded-xl text-xs sm:text-sm font-medium transition-all',
                outOfMonth   ? 'invisible'                     : '',
                disabled && !outOfMonth ? 'text-gray-300 cursor-not-allowed' : '',
                !disabled    ? 'hover:bg-gray-100 cursor-pointer' : '',
                selected     ? 'text-white shadow-md'          : '',
                todayFlag && !selected ? 'font-bold'           : '',
              ].join(' ')}
              style={selected ? { background: BRAND } : todayFlag && !selected ? { color: BRAND } : {}}
            >
              {format(day, 'd')}
              {todayFlag && !selected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: BRAND }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── SlotGrid ─────────────────────────────────────────────────────────────────
function SlotGrid({ slots, selectedSlot, onSelect, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 mt-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse h-10 rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }
  if (!slots) return null
  if (slots.length === 0) {
    return (
      <div className="mt-4 py-6 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl">
        No hay turnos disponibles para este día.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 mt-4">
      {slots.map((slot) => {
        const isSelected = selectedSlot?.label === slot.label
        return (
          <button key={slot.label} onClick={() => onSelect(slot)}
            className="py-2.5 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all"
            style={isSelected
              ? { background: BRAND, borderColor: BRAND, color: '#fff' }
              : { background: '#fff', borderColor: '#e5e7eb', color: '#374151' }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = BRAND }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#e5e7eb' }}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── ClientForm ───────────────────────────────────────────────────────────────
function ClientForm({ onSubmit, loading }) {
  const [form, setForm]     = useState({ name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors] = useState({})

  // Limpiar el error del campo al empezar a escribir
  const set = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: null }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validateClientForm(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit(form)
  }

  const inputClass = (field) => [
    'w-full rounded-xl border px-4 py-2.5 sm:py-3 text-sm text-gray-800',
    'placeholder-gray-400 focus:outline-none focus:ring-2 transition-all',
    errors[field] ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-gray-200',
  ].join(' ')

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre completo <span className="text-red-400">*</span>
        </label>
        <input type="text" value={form.name} onChange={set('name')}
          placeholder="Ej: Laura García" autoComplete="name"
          className={inputClass('name')} />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Teléfono */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Teléfono <span className="text-red-400">*</span>
        </label>
        <input type="tel" value={form.phone} onChange={set('phone')}
          placeholder="+54 11 1234-5678" autoComplete="tel"
          className={inputClass('phone')} />
        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Email <span className="text-gray-400 font-normal text-xs">(opcional)</span>
        </label>
        <input type="email" value={form.email} onChange={set('email')}
          placeholder="tu@email.com" autoComplete="email"
          className={inputClass('email')} />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Notas <span className="text-gray-400 font-normal text-xs">(opcional)</span>
        </label>
        <textarea value={form.notes} onChange={set('notes')} rows={3} resize="none"
          placeholder="¿Algo que debamos saber antes de tu turno?"
          className={`${inputClass('notes')} resize-none`} />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3 sm:py-3.5 rounded-xl font-semibold text-white text-sm transition-all mt-2 disabled:opacity-60"
        style={{ background: loading ? '#6b7280' : BRAND }}
        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = BRAND_HOVER }}
        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = BRAND }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Confirmando...
          </span>
        ) : 'Confirmar reserva'}
      </button>
    </form>
  )
}

// ─── SuccessScreen ────────────────────────────────────────────────────────────
function SuccessScreen({ service, slot, onReset }) {
  return (
    <div className="text-center py-2">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: BRAND_LIGHT }}>
        <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke={BRAND} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">¡Turno solicitado!</h2>
      <p className="text-gray-500 text-sm mb-5">Te contactaremos para confirmar tu turno.</p>

      <div className="rounded-2xl p-4 text-left space-y-2 mb-5 text-sm" style={{ background: BRAND_LIGHT }}>
        {[
          { label: 'Servicio',  value: service.name },
          { label: 'Fecha',     value: format(slot.start, "EEEE d 'de' MMMM", { locale: es }) },
          { label: 'Hora',      value: `${slot.label} hs` },
          { label: 'Duración',  value: `${service.duration} min` },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-gray-500">{label}</span>
            <span className="font-semibold text-gray-800 capitalize">{value}</span>
          </div>
        ))}
      </div>

      <button onClick={onReset}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all border-2"
        style={{ borderColor: BRAND, color: BRAND }}
        onMouseEnter={(e) => { e.currentTarget.style.background = BRAND; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = BRAND }}
      >
        Reservar otro turno
      </button>
    </div>
  )
}

// ─── BookingPage ──────────────────────────────────────────────────────────────
export function BookingPage() {
  const [step, setStep]   = useState(0)
  const [services, setServices]           = useState([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate]       = useState(null)
  const [selectedSlot, setSelectedSlot]       = useState(null)
  const [businessHours, setBusinessHours]     = useState(null)
  const [blockedDates, setBlockedDates]       = useState([])
  const [slots, setSlots]         = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [done, setDone]                 = useState(false)
  const [bookedSlot, setBookedSlot]     = useState(null)

  // Carga inicial: servicios + config del negocio
  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: svcs, error: svcsErr }, hours, blocked] = await Promise.all([
          supabase.from('services').select('*').eq('active', true).order('name'),
          getBusinessHours(),
          getBlockedDates(),
        ])
        if (svcsErr) throw svcsErr
        setServices(svcs ?? [])
        setBusinessHours(hours)
        setBlockedDates(blocked)
      } catch {
        toast.error('No se pudo cargar la información. Verificá tu conexión e intentá de nuevo.')
      } finally {
        setServicesLoading(false)
      }
    }
    load()
  }, [])

  // Carga de slots cuando cambia fecha o servicio
  useEffect(() => {
    if (!selectedDate || !selectedService) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    getAvailableSlots(selectedDate, selectedService.id)
      .then(setSlots)
      .catch(() => {
        setSlots([])
        toast.error('No se pudieron cargar los horarios. Intentá de nuevo.')
      })
      .finally(() => setSlotsLoading(false))
  }, [selectedDate, selectedService])

  const handleSelectService = (service) => {
    setSelectedService(service)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlots(null)
    setStep(1)
  }

  const handleSelectDate = (day) => {
    setSelectedDate(day)
    setSelectedSlot(null)
  }

  // FIX — Race condition: re-verifica disponibilidad justo antes de insertar.
  // Si el slot ya fue tomado por otro usuario entre que lo seleccionó y confirmó,
  // muestra error y vuelve al paso 2 con los slots actualizados.
  const handleClientSubmit = async (clientData) => {
    setSubmitting(true)
    try {
      // 1. Re-fetch de slots frescos para detectar conflictos
      const freshSlots = await getAvailableSlots(selectedDate, selectedService.id)
      const stillAvailable = freshSlots.some((s) => s.label === selectedSlot.label)

      if (!stillAvailable) {
        toast.error('Este horario acaba de ser reservado por otra persona. Por favor elegí otro.', { duration: 5000 })
        setSlots(freshSlots)
        setSelectedSlot(null)
        setStep(1)
        setSubmitting(false)
        return
      }

      // 2. Insertar la cita
      await createAppointment({
        client_name:  clientData.name,
        client_phone: clientData.phone,
        client_email: clientData.email  || null,
        notes:        clientData.notes  || null,
        service_id:   selectedService.id,
        start_time:   selectedSlot.start.toISOString(),
        end_time:     selectedSlot.end.toISOString(),
      })

      setBookedSlot(selectedSlot)
      setDone(true)
      toast.success('¡Turno reservado con éxito!')
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('Este horario ya no está disponible. Por favor elegí otro.')
        setSelectedSlot(null)
        setStep(1)
        const freshSlots = await getAvailableSlots(selectedDate, selectedService.id).catch(() => [])
        setSlots(freshSlots)
      } else {
        toast.error('No se pudo reservar el turno. Verificá tu conexión e intentá de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep(0)
    setSelectedService(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlots(null)
    setBookedSlot(null)
    setDone(false)
  }

  const canContinue = selectedDate && selectedSlot

  return (
    <div className="min-h-screen py-6 sm:py-10 px-3 sm:px-4" style={{ background: '#f7faf9' }}>
      <div className="max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm"
            style={{ background: BRAND }}>
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reserva tu turno</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Rápido, simple y sin llamadas</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6">
          {done ? (
            <SuccessScreen
              service={selectedService}
              slot={bookedSlot}
              onReset={handleReset}
            />
          ) : (
            <>
              <StepIndicator current={step} />

              {/* PASO 1 — Servicio */}
              {step === 0 && (
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3 sm:mb-4">
                    ¿Qué servicio necesitás?
                  </h2>
                  {servicesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-20 sm:h-24 rounded-2xl bg-gray-100" />)}
                    </div>
                  ) : services.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      No hay servicios disponibles por el momento.
                    </p>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {services.map((s) => (
                        <ServiceCard key={s.id} service={s} onClick={() => handleSelectService(s)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PASO 2 — Fecha y hora */}
              {step === 1 && (
                <div>
                  {/* Badge servicio seleccionado */}
                  <div className="flex items-center justify-between rounded-xl px-3 sm:px-4 py-2.5 mb-4 sm:mb-5 text-sm"
                    style={{ background: BRAND_LIGHT }}>
                    <span className="font-semibold text-sm" style={{ color: BRAND }}>{selectedService?.name}</span>
                    <button onClick={() => setStep(0)} className="text-xs underline ml-2 shrink-0" style={{ color: BRAND }}>
                      Cambiar
                    </button>
                  </div>

                  <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">Elegí un día</h2>

                  <MiniCalendar
                    businessHours={businessHours}
                    blockedDates={blockedDates}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />

                  {selectedDate && (
                    <div className="mt-4 sm:mt-5">
                      <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-0.5">
                        Horarios disponibles
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-400 mb-2 capitalize">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <SlotGrid
                        slots={slots}
                        selectedSlot={selectedSlot}
                        onSelect={setSelectedSlot}
                        loading={slotsLoading}
                      />
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3 mt-5 sm:mt-6">
                    <button onClick={() => setStep(0)}
                      className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                      Atrás
                    </button>
                    <button onClick={() => setStep(2)} disabled={!canContinue}
                      className="flex-1 py-2.5 sm:py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{ background: canContinue ? BRAND : '#9ca3af' }}>
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 3 — Datos del cliente */}
              {step === 2 && (
                <div>
                  {/* Resumen */}
                  <div className="rounded-xl px-3 sm:px-4 py-3 mb-4 sm:mb-5 text-sm space-y-1"
                    style={{ background: BRAND_LIGHT }}>
                    <div className="flex justify-between items-start">
                      <span className="font-semibold" style={{ color: BRAND }}>{selectedService?.name}</span>
                      <button onClick={() => setStep(1)} className="text-xs underline ml-2 shrink-0" style={{ color: BRAND }}>
                        Cambiar
                      </button>
                    </div>
                    <p className="text-gray-600 text-xs capitalize">
                      {selectedDate && format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                      {selectedSlot && ` · ${selectedSlot.label} hs`}
                    </p>
                  </div>

                  <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3 sm:mb-4">
                    Tus datos de contacto
                  </h2>

                  <ClientForm onSubmit={handleClientSubmit} loading={submitting} />

                  <button onClick={() => setStep(1)}
                    className="w-full mt-2 sm:mt-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Atrás
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center mt-4 text-xs text-gray-400">
          ¿Sos administrador?{' '}
          <a href="/login" className="underline" style={{ color: BRAND }}>Ingresá acá</a>
        </p>
      </div>
    </div>
  )
}
