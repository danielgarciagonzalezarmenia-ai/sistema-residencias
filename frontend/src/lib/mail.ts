// Servicio de envío de correos — Canal principal: Backend Render (Nodemailer per-tenant)
// Respaldo: EmailJS (si está configurado)

interface EmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  fromName?: string;
  type?: 'package' | 'announcement' | 'pqrs' | 'payment' | 'general';
  recipientId?: string;
  tenantId?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://notificaciones-residentepro2.onrender.com';

export async function sendEmail({ toEmail, toName, subject, message, fromName, type, recipientId, tenantId }: EmailParams): Promise<{ success: boolean; mode: 'backend' | 'emailjs' | 'demo'; message: string }> {

  // ── Canal 1: Backend propio en Render (Gmail del admin) ──
  if (tenantId) {
    try {
      const response = await fetch(`${BACKEND_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: recipientId || undefined,
          recipientEmail: toEmail,
          tenantId,
          subject,
          body: message,
          type: type || 'general',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          mode: 'backend',
          message: `Correo enviado a ${toEmail} desde el Gmail de la administración.`,
        };
      }

      // Si el admin no tiene configurado su Gmail, mostrar error descriptivo
      console.warn('Backend error:', data.error);
    } catch (error) {
      console.warn('Error conectando al backend de correo:', error);
    }
  }

  // ── Canal 2: EmailJS (respaldo) ──
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  if (serviceId && templateId && publicKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: toEmail,
            to_name: toName,
            from_name: fromName || 'Administración',
            subject: subject,
            message: message,
          },
        }),
      });

      if (response.ok) {
        return {
          success: true,
          mode: 'emailjs',
          message: `Correo enviado a ${toEmail} vía EmailJS.`,
        };
      }
    } catch (error) {
      console.warn('Error con EmailJS:', error);
    }
  }

  // ── Canal 3: Modo Demo ──
  console.warn(
    `[Email Demo] Correo simulado a: ${toEmail}\n` +
    `Asunto: ${subject}\n` +
    `Mensaje: ${message}`
  );
  return {
    success: true,
    mode: 'demo',
    message: `[Demo] Correo simulado a ${toEmail}.`,
  };
}
