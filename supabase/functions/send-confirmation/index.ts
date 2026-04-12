// supabase/functions/send-confirmation/index.ts
// Deno runtime — no imports from npm, usa fetch nativo

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Service {
  id: string
  name: string
  duration: number
  price: number
}

interface Appointment {
  id: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  service_id: string
  starts_at: string
  ends_at: string | null
  status: string
  notes: string | null
  cancellation_token?: string | null  // columna opcional — no en schema base
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Appointment
  old_record: Appointment | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formatea fecha ISO a "Lunes 14 de abril de 2025, 10:30 hs" */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(date)
}

/** Genera un token de cancelación seguro (hex 32 bytes) */
function generateCancellationToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function buildEmailHtml(opts: {
  clientName: string
  serviceName: string
  duration: number
  price: number
  dateFormatted: string
  address: string
  cancelUrl: string
  salonName: string
  notes: string | null
}): string {
  const { clientName, serviceName, duration, price, dateFormatted, address, cancelUrl, salonName, notes } = opts

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cita confirmada</title>
</head>
<body style="margin:0;padding:0;background:#f7faf9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7faf9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#1a4a42;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#a8d5cd;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Reserva confirmada ✓</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">${salonName}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;">
                Hola <strong>${clientName}</strong>, tu turno quedó registrado. Te confirmamos a la brevedad.
              </p>

              <!-- Resumen de la cita -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#e8f0ef;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color:#6b7280;font-size:14px;width:40%;">Servicio</td>
                        <td style="color:#111827;font-size:14px;font-weight:600;">${serviceName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #c9dbd8;">
                    <table width="100%">
                      <tr>
                        <td style="color:#6b7280;font-size:14px;width:40%;">Duración</td>
                        <td style="color:#111827;font-size:14px;font-weight:600;">${duration} minutos</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #c9dbd8;">
                    <table width="100%">
                      <tr>
                        <td style="color:#6b7280;font-size:14px;width:40%;">Precio</td>
                        <td style="color:#1a4a42;font-size:14px;font-weight:700;">${price.toLocaleString('es-ES')} €</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #c9dbd8;">
                    <table width="100%">
                      <tr>
                        <td style="color:#6b7280;font-size:14px;width:40%;">Fecha y hora</td>
                        <td style="color:#111827;font-size:14px;font-weight:600;text-transform:capitalize;">${dateFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #c9dbd8;">
                    <table width="100%">
                      <tr>
                        <td style="color:#6b7280;font-size:14px;width:40%;">Dirección</td>
                        <td style="color:#111827;font-size:14px;font-weight:600;">${address}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${notes ? `
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #c9dbd8;">
                    <table width="100%">
                      <tr>
                        <td style="color:#6b7280;font-size:14px;width:40%;">Notas</td>
                        <td style="color:#111827;font-size:14px;">${notes}</td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ''}
              </table>

              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Si necesitás cancelar tu turno podés hacerlo hasta 2 horas antes usando el siguiente botón.
                Pasado ese tiempo te pedimos que nos llames directamente.
              </p>

              <!-- Botón cancelar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${cancelUrl}"
                      style="display:inline-block;background:#ffffff;color:#1a4a42;border:2px solid #1a4a42;
                             border-radius:10px;padding:12px 32px;font-size:14px;font-weight:600;
                             text-decoration:none;">
                      Cancelar mi turno
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f7faf9;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Este email fue enviado automáticamente. Por favor no respondas a este mensaje.
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">${salonName} · ${address}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // Supabase Database Webhooks envían un POST con el payload
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verificar secret del webhook para evitar llamadas no autorizadas
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (webhookSecret) {
    const authHeader = req.headers.get('x-webhook-secret')
    if (authHeader !== webhookSecret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Solo procesar INSERTs en la tabla appointments
  if (payload.type !== 'INSERT' || payload.table !== 'appointments') {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const appointment = payload.record

  // Si no hay email del cliente, no hay nada que enviar
  if (!appointment.client_email) {
    console.log(`Appointment ${appointment.id}: no client_email, skipping`)
    return new Response(JSON.stringify({ skipped: true, reason: 'no_email' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ------------------------------------------------------------------
  // Obtener datos del servicio desde Supabase
  // ------------------------------------------------------------------
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('id, name, duration, price')
    .eq('id', appointment.service_id)
    .single() as { data: Service | null; error: unknown }

  if (serviceError || !service) {
    console.error('Error fetching service:', serviceError)
    return new Response(JSON.stringify({ error: 'service_not_found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ------------------------------------------------------------------
  // Generar y guardar token de cancelación
  // ------------------------------------------------------------------
  const cancellationToken = generateCancellationToken()

  await supabaseAdmin
    .from('appointments')
    .update({ cancellation_token: cancellationToken })
    .eq('id', appointment.id)

  // ------------------------------------------------------------------
  // Variables de entorno del negocio
  // ------------------------------------------------------------------
  const salonName    = Deno.env.get('SALON_NAME')    ?? 'Peluquería'
  const salonAddress = Deno.env.get('SALON_ADDRESS') ?? ''
  const appUrl       = Deno.env.get('APP_URL')       ?? ''
  const resendApiKey = Deno.env.get('RESEND_API_KEY')!
  const fromEmail    = Deno.env.get('FROM_EMAIL')    ?? `noreply@${new URL(appUrl || 'http://localhost').hostname}`

  if (!resendApiKey) {
    console.error('RESEND_API_KEY not set')
    return new Response(JSON.stringify({ error: 'resend_key_missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ------------------------------------------------------------------
  // Construir email
  // ------------------------------------------------------------------
  const cancelUrl = `${appUrl}/cancel?token=${cancellationToken}`
  const dateFormatted = formatDate(appointment.starts_at)

  const html = buildEmailHtml({
    clientName:    appointment.client_name,
    serviceName:   service.name,
    duration:      service.duration,
    price:         service.price,
    dateFormatted,
    address:       salonAddress,
    cancelUrl,
    salonName,
    notes:         appointment.notes,
  })

  // ------------------------------------------------------------------
  // Enviar con Resend
  // ------------------------------------------------------------------
  const resendPayload = {
    from:    `${salonName} <${fromEmail}>`,
    to:      [appointment.client_email],
    subject: `Cita confirmada en ${salonName}`,
    html,
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(resendPayload),
  })

  if (!resendRes.ok) {
    const resendError = await resendRes.text()
    console.error('Resend error:', resendError)
    return new Response(JSON.stringify({ error: 'resend_failed', detail: resendError }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const resendData = await resendRes.json()
  console.log(`Email sent for appointment ${appointment.id}, resend_id: ${resendData.id}`)

  return new Response(
    JSON.stringify({ success: true, resend_id: resendData.id }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
