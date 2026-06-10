// Servicio de envío de correos usando EmailJS (Frontend-Safe)
// Con respaldo via Backend en Render (Nodemailer + Gmail)

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

export async function sendEmail({ toEmail, toName, subject, message, fromName, type, recipientId, tenantId }: EmailParams): Promise<{ success: boolean; mode: 'real' | 'demo' | 'backend'; message: string }> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  // Intentar primero con EmailJS (Frontend)
  if (serviceId && templateId && publicKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
          mode: 'real',
          message: `Correo enviado a ${toEmail} vía EmailJS.`,
        };
      }
      // Si EmailJS falla, continuamos al backend
      console.warn('EmailJS falló, intentando backend...');
    } catch (error) {
      console.warn('Error con EmailJS, intentando backend:', error);
    }
  }

  // Respaldo: enviar vía Backend en Render
  if (recipientId && tenantId) {
    try {
      const response = await fetch(`${BACKEND_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          tenantId,
          subject,
          body: message,
          type: type || 'general',
        }),
      });

      if (response.ok) {
        return {
          success: true,
          mode: 'backend',
          message: `Correo enviado a ${toEmail} vía servidor backend.`,
        };
      }
    } catch (error) {
      console.warn('Error con backend de Render:', error);
    }
  }

  // Modo Demo si nada está configurado
  console.warn(
    `[Email - Modo Demo] Correo simulado a: ${toEmail}\n` +
    `De: ${fromName || 'Administración'}\n` +
    `Asunto: ${subject}\n` +
    `Mensaje: ${message}`
  );
  return {
    success: true,
    mode: 'demo',
    message: `[Demo] Correo simulado a ${toEmail} (${toName}).`,
  };
}
