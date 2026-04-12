import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const BRAND = '#1a4a42'
const BRAND_HOVER = '#14372f'

// Mensajes de error de Supabase en español
function translateError(message) {
  if (!message) return 'Ocurrió un error inesperado'
  if (message.includes('Invalid login credentials'))
    return 'Email o contraseña incorrectos'
  if (message.includes('Email not confirmed'))
    return 'Debés confirmar tu email antes de ingresar'
  if (message.includes('Too many requests'))
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo'
  if (message.includes('User not found'))
    return 'No existe una cuenta con ese email'
  return message
}

export function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm]         = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true) // verifica sesión activa al montar

  // Si ya hay sesión activa, redirigir directo al admin
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/admin', { replace: true })
      else setChecking(false)
    })
  }, [navigate])

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.email.trim() || !form.password) {
      toast.error('Completá email y contraseña')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    form.email.trim().toLowerCase(),
      password: form.password,
    })

    if (error) {
      toast.error(translateError(error.message))
      setLoading(false)
      return
    }

    toast.success(`Bienvenido, ${data.user.email}`)
    navigate('/admin', { replace: true })
    // No reseteamos loading: la navegación desmonta el componente
  }

  // Pantalla de carga mientras verifica sesión existente
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f7faf9' }}>
        <div
          className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: `${BRAND}40`, borderTopColor: BRAND }}
        />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: '#f7faf9' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo / marca */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
            style={{ background: BRAND }}
          >
            {/* Scissors icon */}
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121
                   m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0
                   10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresá con tu cuenta de administrador</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                placeholder="admin@peluqueria.com"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm
                           text-gray-800 placeholder-gray-400 transition-all
                           focus:outline-none focus:border-transparent disabled:bg-gray-50
                           disabled:text-gray-400"
                style={{ '--tw-ring-color': BRAND }}
                onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${BRAND}25`)}
                onBlur={(e)  => (e.currentTarget.style.boxShadow = 'none')}
              />
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-11 text-sm
                             text-gray-800 placeholder-gray-400 transition-all
                             focus:outline-none focus:border-transparent disabled:bg-gray-50
                             disabled:text-gray-400"
                  onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${BRAND}25`)}
                  onBlur={(e)  => (e.currentTarget.style.boxShadow = 'none')}
                />
                {/* Toggle mostrar/ocultar contraseña */}
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400
                             hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? (
                    // Eye-off
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478
                           0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3
                           3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532
                           7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0
                           8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0
                           0L21 21" />
                    </svg>
                  ) : (
                    // Eye
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943
                           9.542 7-1.274 4.057-5.064 7-9.542 7-4.477
                           0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm
                         transition-all disabled:opacity-60 mt-1"
              style={{ background: BRAND }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = BRAND_HOVER }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = BRAND }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>

          </form>
        </div>

        <p className="text-center mt-5 text-sm text-gray-500">
          ¿Querés un turno?{' '}
          <Link to="/" className="font-medium underline" style={{ color: BRAND }}>
            Reservar acá
          </Link>
        </p>

      </div>
    </div>
  )
}
