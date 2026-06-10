// Servicio de envío de correos — Canal principal: Backend Render (Nodemailer per-tenant)
// Sin dependencias de EmailJS

interface EmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  fromName?: string;
  type?: 'package' | 'announcement' | 'pqrs' | 'payment' | 'general';
  recipientId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://notificaciones-residentepro2.onrender.com';

export async function sendEmail({ toEmail, toName, subject, message, fromName, type, recipientId, tenantId, metadata }: EmailParams): Promise<{ success: boolean; mode: 'backend' | 'demo'; message: string }> {

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
          metadata,
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

  // ── Canal 2: Modo Demo ──
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
