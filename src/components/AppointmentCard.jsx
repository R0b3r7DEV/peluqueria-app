import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
}

const STATUS_LABELS = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
}

export function AppointmentCard({ appointment, onConfirm, onCancel, isAdmin }) {
  const { client_name, client_phone, start_time, services, status, notes } = appointment
  const date = new Date(start_time)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{client_name}</h3>
          {client_phone && (
            <p className="text-sm text-gray-500">{client_phone}</p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-gray-600">
        <p>
          <span className="font-medium">Fecha:</span>{' '}
          {format(date, "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}
        </p>
        {services && (
          <p>
            <span className="font-medium">Servicio:</span> {services.name} ({services.duration} min)
          </p>
        )}
        {notes && (
          <p>
            <span className="font-medium">Notas:</span> {notes}
          </p>
        )}
      </div>

      {isAdmin && status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onConfirm(appointment.id)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
          >
            Confirmar
          </button>
          <button
            onClick={() => onCancel(appointment.id)}
            className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium py-1.5 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
