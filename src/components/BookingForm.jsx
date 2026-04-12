import { useState } from 'react'
import { ServiceSelector } from './ServiceSelector'
import { format, addMinutes } from 'date-fns'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
  client_name: '',
  client_phone: '',
  service_id: '',
  start_time: '',
  notes: '',
}

export function BookingForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(false)

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.client_name || !form.service_id || !form.start_time) {
      toast.error('Completa todos los campos obligatorios')
      return
    }
    setLoading(true)
    try {
      await onSubmit({ ...form, status: 'pending' })
      toast.success('Turno reservado correctamente')
      setForm(INITIAL_FORM)
    } catch (err) {
      toast.error(err.message || 'Error al reservar el turno')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.client_name}
          onChange={handleChange('client_name')}
          placeholder="Tu nombre completo"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <input
          type="tel"
          value={form.client_phone}
          onChange={handleChange('client_phone')}
          placeholder="+54 11 1234-5678"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <ServiceSelector
        value={form.service_id}
        onChange={(val) => setForm((prev) => ({ ...prev, service_id: val }))}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha y hora <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          value={form.start_time}
          onChange={handleChange('start_time')}
          min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas adicionales
        </label>
        <textarea
          value={form.notes}
          onChange={handleChange('notes')}
          placeholder="Algo que debamos saber..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-medium py-2 rounded-lg transition-colors"
        >
          {loading ? 'Reservando...' : 'Reservar turno'}
        </button>
      </div>
    </form>
  )
}
