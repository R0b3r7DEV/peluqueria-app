import { useMemo } from 'react'
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'

moment.locale('es')
const localizer = momentLocalizer(moment)

const MESSAGES = {
  today: 'Hoy',
  previous: '←',
  next: '→',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Turno',
  noEventsInRange: 'No hay turnos en este rango.',
}

export function Calendar({ appointments, onSelectSlot, onSelectEvent }) {
  const events = useMemo(() =>
    appointments.map((apt) => ({
      id: apt.id,
      title: `${apt.client_name}${apt.services ? ` — ${apt.services.name}` : ''}`,
      start: new Date(apt.start_time),
      end: apt.end_time
        ? new Date(apt.end_time)
        : moment(apt.start_time).add(apt.services?.duration || 30, 'minutes').toDate(),
      resource: apt,
    })),
    [appointments]
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" style={{ height: 600 }}>
      <BigCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        messages={MESSAGES}
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={(event) => onSelectEvent && onSelectEvent(event.resource)}
        defaultView="week"
        views={['month', 'week', 'day', 'agenda']}
        min={new Date(0, 0, 0, 8, 0)}
        max={new Date(0, 0, 0, 20, 0)}
        style={{ height: '100%' }}
      />
    </div>
  )
}
