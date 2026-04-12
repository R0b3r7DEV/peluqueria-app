import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function ServiceSelector({ value, onChange }) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase.from('services').select('*').order('name')
      setServices(data || [])
      setLoading(false)
    }
    fetchServices()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse h-10 bg-gray-200 rounded-lg" />
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Servicio
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        <option value="">Selecciona un servicio</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name} — {service.duration} min — {Number(service.price).toLocaleString('es-ES')} €
          </option>
        ))}
      </select>
    </div>
  )
}
