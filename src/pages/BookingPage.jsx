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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = ['Servicio', 'Fecha y hora', 'Tus datos']
const BRAND = '#1a4a42'
const BRAND_LIGHT = '#e8f0ef'
const BRAND_HOVER = '#14372f'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                style={{
                  background: done || active ? BRAND : '#e5e7eb',
                  color: done || active ? '#fff' : '#9ca3af',
                }}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: active ? BRAND : done ? '#6b7280' : '#9ca3af' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-16 sm:w-24 h-0.5 mb-4 mx-1 transition-all"
                style={{ background: done ? BRAND : '#e5e7eb' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ServiceCard({ service, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white border-2 border-gray-100 rounded-2xl p-5 hover:border-transparent hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ '--tw-ring-color': BRAND }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = BRAND)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f3f4f6')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-snug">{service.name}</h3>
          {service.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
          )}
        </div>
        <div
          className="shrink-0 rounded-full p-1.5 transition-transform group-hover:scale-110"
          style={{ background: BRAND_LIGHT }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={BRAND} strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          {service.duration} min
        </span>
        <span
          className="text-base font-bold"
          style={{ color: BRAND }}
        >
          ${Number(service.price).toLocaleString('es-AR')}
        </span>
      </div>
    </button>
  )
}

function MiniCalendar({ businessHours, blockedDates, selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(new Date())
  const today = startOfDay(new Date())

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let cursor = calStart
  while (cursor <= calEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }

  const isDisabled = (day) => {
    if (isBefore(day, today)) return true
    if (!isSameMonth(day, viewMonth)) return true
    const dow = day.getDay()
    if (businessHours && !businessHours.workDays.includes(dow)) return true
    if (blockedDates.includes(format(day, 'yyyy-MM-dd'))) return true
    return false
  }

  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Header mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Mes anterior"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-gray-800 capitalize">
          {format(viewMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Mes siguiente"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => {
          const disabled = isDisabled(day)
          const selected = selectedDate && isSameDay(day, selectedDate)
          const todayFlag = isToday(day)
          const outOfMonth = !isSameMonth(day, viewMonth)

          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => !disabled && onSelectDate(day)}
              className={[
                'relative w-full aspect-square rounded-xl text-sm font-medium transition-all',
                outOfMonth ? 'invisible' : '',
                disabled && !outOfMonth ? 'text-gray-300 cursor-not-allowed' : '',
                !disabled ? 'hover:bg-gray-100 cursor-pointer' : '',
                selected ? 'text-white shadow-md' : '',
                todayFlag && !selected ? 'font-bold' : '',
              ].join(' ')}
              style={selected ? { background: BRAND } : todayFlag && !selected ? { color: BRAND } : {}}
            >
              {format(day, 'd')}
              {todayFlag && !selected && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: BRAND }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SlotGrid({ slots, selectedSlot, onSelect, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse h-10 rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!slots) return null

  if (slots.length === 0) {
    return (
      <div className="mt-4 py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl">
        No hay turnos disponibles para este día.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-4">
      {slots.map((slot) => {
        const isSelected = selectedSlot?.label === slot.label
        return (
          <button
            key={slot.label}
            onClick={() => onSelect(slot)}
            className="py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
            style={
              isSelected
                ? { background: BRAND, borderColor: BRAND, color: '#fff' }
                : { background: '#fff', borderColor: '#e5e7eb', color: '#374151' }
            }
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.borderColor = BRAND
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

function ClientForm({ onSubmit, loading }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors] = useState({})

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'El nombre es obligatorio'
    if (!form.phone.trim()) e.phone = 'El teléfono es obligatorio'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    onSubmit(form)
  }

  const inputClass = (field) =>
    `w-full rounded-xl border px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
      errors[field]
        ? 'border-red-300 focus:ring-red-200'
        : 'border-gray-200 focus:ring-opacity-50'
    }`

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre completo <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="Ej: Laura García"
          className={inputClass('name')}
          style={{ '--tw-ring-color': BRAND + '40' }}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Teléfono <span className="text-red-400">*</span>
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          placeholder="+54 11 1234-5678"
          className={inputClass('phone')}
        />
        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Email <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="tu@email.com"
          className={inputClass('email')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Notas adicionales <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          placeholder="¿Algo que debamos saber antes de tu turno?"
          rows={3}
          className={`${inputClass('notes')} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl font-semibold text-white transition-all text-sm mt-2 disabled:opacity-60"
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
        ) : (
          'Confirmar reserva'
        )}
      </button>
    </form>
  )
}

function SuccessScreen({ appointment, service, slot, onReset }) {
  return (
    <div className="text-center py-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: BRAND_LIGHT }}
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={BRAND} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">¡Turno solicitado!</h2>
      <p className="text-gray-500 text-sm mb-6">
        Te contactaremos para confirmar tu turno.
      </p>

      <div
        className="rounded-2xl p-4 text-left space-y-2 mb-6 text-sm"
        style={{ background: BRAND_LIGHT }}
      >
        <div className="flex justify-between">
          <span className="text-gray-500">Servicio</span>
          <span className="font-semibold text-gray-800">{service.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha</span>
          <span className="font-semibold text-gray-800 capitalize">
            {format(slot.start, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Hora</span>
          <span className="font-semibold text-gray-800">{slot.label} hs</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Duración</span>
          <span className="font-semibold text-gray-800">{service.duration} min</span>
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all border-2"
        style={{ borderColor: BRAND, color: BRAND }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = BRAND
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = BRAND
        }}
      >
        Reservar otro turno
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BookingPage() {
  const [step, setStep] = useState(0)
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(true)

  // selections
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // calendar config
  const [businessHours, setBusinessHours] = useState(null)
  const [blockedDates, setBlockedDates] = useState([])

  // slots
  const [slots, setSlots] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // booking
  const [submitting, setSubmitting] = useState(false)
  const [bookedAppointment, setBookedAppointment] = useState(null)
  const [done, setDone] = useState(false)

  // Load services + config on mount
  useEffect(() => {
    const load = async () => {
      const [{ data: svcs }, hours, blocked] = await Promise.all([
        supabase.from('services').select('*').order('name'),
        getBusinessHours(),
        getBlockedDates(),
      ])
      setServices(svcs || [])
      setBusinessHours(hours)
      setBlockedDates(blocked)
      setServicesLoading(false)
    }
    load()
  }, [])

  // Load slots whenever date or service changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    getAvailableSlots(selectedDate, selectedService.id)
      .then(setSlots)
      .catch(() => setSlots([]))
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

  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot)
  }

  const handleClientSubmit = async (clientData) => {
    setSubmitting(true)
    try {
      const apt = await createAppointment({
        client_name: clientData.name,
        client_phone: clientData.phone,
        client_email: clientData.email || null,
        notes: clientData.notes || null,
        service_id: selectedService.id,
        start_time: selectedSlot.start.toISOString(),
        end_time: selectedSlot.end.toISOString(),
      })
      setBookedAppointment(apt)
      setDone(true)
      toast.success('¡Turno reservado con éxito!')
    } catch (err) {
      toast.error(err.message || 'No se pudo reservar el turno')
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
    setBookedAppointment(null)
    setDone(false)
  }

  const canGoToStep3 = selectedDate && selectedSlot

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#f7faf9' }}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
            style={{ background: BRAND }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reserva tu turno</h1>
          <p className="text-gray-500 text-sm mt-1">Rápido, simple y sin llamadas</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">

          {done ? (
            <SuccessScreen
              appointment={bookedAppointment}
              service={selectedService}
              slot={selectedSlot}
              onReset={handleReset}
            />
          ) : (
            <>
              <StepIndicator current={step} />

              {/* ── PASO 1: Servicio ── */}
              {step === 0 && (
                <div>
                  <h2 className="text-base font-semibold text-gray-700 mb-4">
                    ¿Qué servicio necesitás?
                  </h2>
                  {servicesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse h-24 rounded-2xl bg-gray-100" />
                      ))}
                    </div>
                  ) : services.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      No hay servicios disponibles por el momento.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {services.map((s) => (
                        <ServiceCard key={s.id} service={s} onClick={() => handleSelectService(s)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── PASO 2: Fecha y hora ── */}
              {step === 1 && (
                <div>
                  {/* Servicio seleccionado (resumen) */}
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3 mb-5 text-sm"
                    style={{ background: BRAND_LIGHT }}
                  >
                    <span className="font-semibold" style={{ color: BRAND }}>
                      {selectedService?.name}
                    </span>
                    <button
                      onClick={() => setStep(0)}
                      className="text-xs underline"
                      style={{ color: BRAND }}
                    >
                      Cambiar
                    </button>
                  </div>

                  <h2 className="text-base font-semibold text-gray-700 mb-4">
                    Elegí un día
                  </h2>

                  <MiniCalendar
                    businessHours={businessHours}
                    blockedDates={blockedDates}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />

                  {selectedDate && (
                    <div className="mt-5">
                      <h2 className="text-base font-semibold text-gray-700 mb-1">
                        Horarios disponibles
                      </h2>
                      <p className="text-sm text-gray-400 mb-2 capitalize">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <SlotGrid
                        slots={slots}
                        selectedSlot={selectedSlot}
                        onSelect={handleSelectSlot}
                        loading={slotsLoading}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setStep(0)}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Atrás
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      disabled={!canGoToStep3}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{ background: canGoToStep3 ? BRAND : '#9ca3af' }}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* ── PASO 3: Datos del cliente ── */}
              {step === 2 && (
                <div>
                  {/* Resumen selección */}
                  <div
                    className="rounded-xl px-4 py-3 mb-5 text-sm space-y-1"
                    style={{ background: BRAND_LIGHT }}
                  >
                    <div className="flex justify-between">
                      <span style={{ color: BRAND }} className="font-semibold">
                        {selectedService?.name}
                      </span>
                      <button
                        onClick={() => setStep(1)}
                        className="text-xs underline"
                        style={{ color: BRAND }}
                      >
                        Cambiar
                      </button>
                    </div>
                    <p className="text-gray-600 capitalize">
                      {selectedDate && format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                      {selectedSlot && ` · ${selectedSlot.label} hs`}
                    </p>
                  </div>

                  <h2 className="text-base font-semibold text-gray-700 mb-4">
                    Tus datos de contacto
                  </h2>

                  <ClientForm onSubmit={handleClientSubmit} loading={submitting} />

                  <button
                    onClick={() => setStep(1)}
                    className="w-full mt-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Atrás
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center mt-5 text-xs text-gray-400">
          ¿Sos administrador?{' '}
          <a href="/login" className="underline" style={{ color: BRAND }}>
            Ingresá acá
          </a>
        </p>
      </div>
    </div>
  )
}
