// Servicio de envío de correos usando EmailJS (Frontend-Safe)
// Si el usuario no ha configurado EmailJS, funcionará en modo "Demo" alertando visualmente.

interface EmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
}

export async function sendEmail({ toEmail, toName, subject, message }: EmailParams): Promise<{ success: boolean; mode: 'real' | 'demo'; message: string }> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn(
      `[EmailJS - Modo Demo] No se han configurado las variables de entorno para EmailJS.\n` +
      `Enviando correo ficticio a: ${toEmail}\n` +
      `Asunto: ${subject}\n` +
      `Mensaje: ${message}`
    );
    return {
      success: true,
      mode: 'demo',
      message: `[Demo] Correo enviado a ${toEmail} (${toName}) exitosamente.`,
    };
  }

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
          subject: subject,
          message: message,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error en la petición de EmailJS');
    }

    return {
      success: true,
      mode: 'real',
      message: `Correo real enviado a ${toEmail} a través de EmailJS.`,
    };
  } catch (error: any) {
    console.error('Error al enviar correo con EmailJS:', error);
    throw new Error(error.message || 'Error al enviar el correo.');
  }
}
