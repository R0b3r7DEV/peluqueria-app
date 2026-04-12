import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BRAND = '#1a4a42'

/**
 * Protege rutas que requieren sesión activa.
 *
 * - Mientras verifica la sesión muestra un spinner (evita flash de redireccionamiento).
 * - Si no hay sesión redirige a /login y guarda la ruta original en `state.from`
 *   para que LoginPage pueda volver ahí tras el login.
 * - Se suscribe a onAuthStateChange para reaccionar si la sesión expira o
 *   el usuario cierra sesión desde otra pestaña.
 *
 * Uso:
 *   <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
 */
export function ProtectedRoute({ children }) {
  const location = useLocation()
  const [status, setStatus] = useState('checking') // 'checking' | 'authenticated' | 'unauthenticated'

  useEffect(() => {
    // Verificación inicial de sesión
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    })

    // Escuchar cambios de sesión en tiempo real
    // (logout desde otra pestaña, token expirado, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authenticated' : 'unauthenticated')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (status === 'checking') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: '#f7faf9' }}
      >
        <div
          className="w-10 h-10 rounded-full border-4 animate-spin"
          style={{
            borderColor: `${BRAND}30`,
            borderTopColor: BRAND,
          }}
        />
        <p className="text-sm text-gray-400">Verificando sesión...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    // Guarda la ruta intentada para redirigir después del login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
