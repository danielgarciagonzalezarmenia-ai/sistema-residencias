const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Firebase Admin ──────────────────────────────────────
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin Initialized');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
}

// ── Obtener Access Token de Gmail API via OAuth2 ──────────
async function getGmailAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('El servidor no tiene configuradas las credenciales de Google OAuth2 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google OAuth Error: ${data.error_description || data.error || response.statusText}`);
  }

  return data.access_token;
}

// ── Endpoint: Enviar correo ─────────────────────────────
// ── Helper: Enviar correo (Compartido por Endpoint y Cron) ──
function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N");
}

async function sendEmailHelper({ recipientId, recipientEmail, tenantId, subject, body, type, metadata = {} }) {
  if (!tenantId || !subject || !body) {
    throw new Error('Faltan parámetros: tenantId, subject, body');
  }

  // Obtener información del tenant
  const tenantDoc = await admin.firestore().collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) {
    throw new Error('Conjunto residencial no encontrado');
  }
  const tenantData = tenantDoc.data();
  const tenantName = tenantData.name || 'Tu Conjunto';
  const replyToEmail = tenantData.smtpEmail || null;

  // Determinar el email del destinatario
  let toEmail = recipientEmail || null;
  let toName = '';

  if (!toEmail && recipientId) {
    if (recipientId === 'ADMIN') {
      const adminSnap = await admin.firestore().collection('users')
        .where('tenantId', '==', tenantId)
        .where('role', '==', 'ADMINISTRADOR')
        .limit(1)
        .get();
      if (!adminSnap.empty) {
        const adminData = adminSnap.docs[0].data();
        toEmail = adminData.email;
        toName = `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim();
      }
    } else {
      const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        toEmail = userData.email;
        toName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      }
    }
  }

  if (!toEmail) {
    throw new Error('No se encontró el correo del destinatario');
  }

  // Obtener información de Torre y Apartamento del residente
  let tower = '';
  let unit = '';
  try {
    const residentsSnap = await admin.firestore().collection('residents')
      .where('tenantId', '==', tenantId)
      .where('email', '==', toEmail)
      .limit(1)
      .get();

    if (!residentsSnap.empty) {
      const resData = residentsSnap.docs[0].data();
      if (resData.properties && resData.properties.length > 0) {
        tower = resData.properties[0].tower || '';
        unit = resData.properties[0].unit || '';
      }
      if (!toName) {
        toName = `${resData.firstName || ''} ${resData.lastName || ''}`.trim();
      }
    }
  } catch (dbErr) {
    console.error('Error buscando torre/apto para logs:', dbErr);
  }

  // Configuración estética basada en el tipo de notificación
  const typeConfig = {
    package: {
      icon: '📦',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      accentColor: '#10b981',
      shadowColor: '16, 185, 129',
      buttonText: 'Ver mis Paquetes'
    },
    announcement: {
      icon: '📢',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
      accentColor: '#8b5cf6',
      shadowColor: '139, 92, 246',
      buttonText: 'Ver Comunicado'
    },
    pqrs: {
      icon: '📋',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      accentColor: '#f59e0b',
      shadowColor: '245, 158, 11',
      buttonText: 'Ver Petición'
    },
    payment: {
      icon: '💰',
      gradient: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
      accentColor: '#ec4899',
      shadowColor: '236, 72, 153',
      buttonText: 'Ver Estado de Cuenta'
    },
    general: {
      icon: '🔔',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      accentColor: '#6366f1',
      shadowColor: '99, 102, 241',
      buttonText: 'Ir a ResidentePro'
    }
  };

  const config = typeConfig[type] || typeConfig.general;

  // Generar sección de contenido según el tipo
  let contentSectionHtml = '';
  
  if (type === 'package') {
    contentSectionHtml = `
    <div style="background-color: #27272a; border-radius: 14px; padding: 24px; border: 1px solid #3f3f46; margin: 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom: 12px;">
            <span style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">Empresa / Mensajería</span>
            <div style="color: #ffffff; font-size: 16px; font-weight: 600; margin-top: 2px; font-family: 'Poppins', sans-serif;">📦 ${metadata.carrier || 'Servientrega'}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 12px; border-top: 1px solid #3f3f46; padding-top: 12px;">
            <span style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">Número de Guía</span>
            <div style="color: #f4f4f5; font-size: 15px; font-family: monospace; font-weight: 700; letter-spacing: 1px; margin-top: 2px;">
              ${metadata.guide || 'Sin número de guía'}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 12px; border-top: 1px solid #3f3f46; padding-top: 12px;">
            <span style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">Fecha de Ingreso</span>
            <div style="color: #ffffff; font-size: 14px; margin-top: 2px; font-family: 'Poppins', sans-serif;">🗓️ ${metadata.date || new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </td>
        </tr>
        <tr>
          <td style="border-top: 1px solid #3f3f46; padding-top: 12px;">
            <span style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">Observaciones del Paquete</span>
            <div style="color: #d4d4d8; font-size: 14px; line-height: 1.5; margin-top: 4px; font-style: italic; font-family: 'Poppins', sans-serif;">
              "${metadata.notes || 'Ninguna'}"
            </div>
          </td>
        </tr>
      </table>
    </div>
    <p style="color: #a1a1aa; font-size: 14px; line-height: 1.7; margin: 0 0 24px; font-family: 'Poppins', sans-serif;">
      Por favor, acércate a la portería en los horarios habituales de atención para retirar tu correspondencia.
    </p>
    `;
  } else if (type === 'announcement') {
    contentSectionHtml = `
    <div style="border-left: 4px solid ${config.accentColor}; background-color: #27272a; border-radius: 4px 14px 14px 4px; padding: 24px; margin: 24px 0; border-top: 1px solid #3f3f46; border-right: 1px solid #3f3f46; border-bottom: 1px solid #3f3f46;">
      <p style="margin: 0; color: #f4f4f5; font-size: 15px; line-height: 1.8; white-space: pre-line; font-family: 'Poppins', sans-serif;">
        ${body}
      </p>
    </div>
    `;
  } else {
    contentSectionHtml = `
    <div style="background-color: #1c1c1e; border-radius: 14px; padding: 24px; border: 1px solid #27272a; margin: 24px 0;">
      <p style="margin: 0; color: #e4e4e7; font-size: 15px; line-height: 1.8; white-space: pre-line; font-family: 'Poppins', sans-serif;">
        ${body}
      </p>
    </div>
    `;
  }

  // HTML premium con tipografía Poppins y alto contraste
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body style="margin:0; padding:0; background-color:#09090b; font-family:'Poppins', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b; padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#18181b; border-radius:20px; overflow:hidden; border:1px solid #27272a; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
            
            <!-- Header -->
            <tr>
              <td style="background: ${config.gradient}; padding:32px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; font-family: 'Poppins', sans-serif; letter-spacing: -0.5px;">
                        Residente<span style="color:#ffffff; opacity:0.8; font-weight: 400;">Pro</span>
                      </h1>
                      <p style="margin:6px 0 0; color:#ffffff; opacity: 0.9; font-size:13px; font-weight:600; font-family: 'Poppins', sans-serif; letter-spacing: 0.5px; text-transform: uppercase;">
                        🏢 ${tenantName}
                      </p>
                    </td>
                    <td align="right" style="font-size:40px; padding-left: 10px;">
                      ${config.icon}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding:40px 40px 32px;">
                ${toName ? `<p style="margin:0 0 16px; color:#a1a1aa; font-size:14px; font-family: 'Poppins', sans-serif;">Hola <strong style="color:#ffffff;">${toName}</strong>,</p>` : ''}
                
                <h2 style="margin:0 0 16px; color:#ffffff; font-size:20px; font-weight:700; font-family: 'Poppins', sans-serif; line-height: 1.4;">
                  ${subject}
                </h2>
                
                ${contentSectionHtml}
                
                <!-- Button -->
                <div style="margin-top: 32px; text-align: center;">
                  <a href="https://danielgarciagonzalezarmenia-ai.github.io/sistema-residencias/dashboard"
                     style="display:inline-block; background:${config.gradient}; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:12px; font-size:14px; font-weight:700; font-family: 'Poppins', sans-serif; box-shadow: 0 4px 15px rgba(${config.shadowColor.split(',').map(Number).join(', ')}, 0.25); text-align: center;">
                     ${config.buttonText} →
                  </a>
                </div>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding:24px 40px; border-top:1px solid #27272a; background-color: #111113;">
                <p style="margin:0; color:#71717a; font-size:11px; text-align:center; line-height: 1.6; font-family: 'Poppins', sans-serif;">
                  Este correo fue enviado por la administración de <strong style="color: #a1a1aa;">${tenantName}</strong>.<br/>
                  Mensaje enviado a través de la plataforma de gestión residencial <strong style="color: #a1a1aa;">ResidentePro</strong>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // 1. Obtener Access Token
  let accessToken;
  try {
    accessToken = await getGmailAccessToken();
  } catch (tokenErr) {
    console.error('❌ Error obteniendo Google access token:', tokenErr);
    
    // Guardar log de error de token
    try {
      await admin.firestore().collection('emails').add({
        tenantId,
        toEmail,
        toName: toName || toEmail,
        subject,
        message: body,
        type: type || 'general',
        status: 'FAILED',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        tower,
        unit,
        errorMessage: 'Error obteniendo Google access token: ' + tokenErr.message,
      });
    } catch (logErr) {
      console.error('Error al guardar log de error de token:', logErr);
    }
    throw tokenErr;
  }

  const senderEmail = process.env.GOOGLE_SENDER_EMAIL || 'residentepro.notificaciones@gmail.com';

  // 2. Construir mensaje MIME
  const cleanTenantName = removeAccents(tenantName);
  const cleanSubject = removeAccents(subject);
  const cleanHtmlContent = removeAccents(htmlContent);

  const encodedDisplayName = `=?utf-8?B?${Buffer.from(cleanTenantName).toString('base64')}?=`;

  const mimeParts = [
    `From: ${encodedDisplayName} <${senderEmail}>`,
    `To: ${toEmail}`,
    `Subject: =?utf-8?B?${Buffer.from(`${config.icon} ${cleanSubject}`).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];

  if (replyToEmail) {
    mimeParts.push(`Reply-To: ${replyToEmail}`);
  }

  mimeParts.push('', Buffer.from(cleanHtmlContent).toString('base64'));
  const rawMime = mimeParts.join('\r\n');

  // 3. Codificar en base64url compatible con Gmail API
  const base64SafeEmail = Buffer.from(rawMime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 4. Enviar mediante Gmail API
  try {
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64SafeEmail,
      }),
    });

    const gmailData = await gmailResponse.json();

    if (!gmailResponse.ok) {
      throw new Error(`Gmail API send failed: ${gmailData.error?.message || gmailResponse.statusText}`);
    }

    console.log(`📧 Correo enviado a ${toEmail} desde ${senderEmail} (Gmail API): ${gmailData.id}`);

    // Log success
    await admin.firestore().collection('emails').add({
      tenantId,
      toEmail,
      toName: toName || toEmail,
      subject,
      message: body,
      type: type || 'general',
      status: 'SUCCESS',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tower,
      unit,
      messageId: gmailData.id,
    });

    return { success: true, messageId: gmailData.id };

  } catch (sendErr) {
    console.error('❌ Error en el envío del correo:', sendErr);
    
    // Log failure
    try {
      await admin.firestore().collection('emails').add({
        tenantId,
        toEmail,
        toName: toName || toEmail,
        subject,
        message: body,
        type: type || 'general',
        status: 'FAILED',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        tower,
        unit,
        errorMessage: sendErr.message,
      });
    } catch (logErr) {
      console.error('Error al guardar log de correo fallido:', logErr);
    }
    throw sendErr;
  }
}

// ── Endpoint: Enviar correo ─────────────────────────────
app.post('/send-email', async (req, res) => {
  try {
    const result = await sendEmailHelper(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    res.status(500).json({ error: 'Error al enviar el correo', details: error.message });
  }
});

// ── Tarea Programada: Recordatorio de Reservas 24h ───────
async function checkReservationReminders() {
  console.log('⏰ Ejecutando verificación de recordatorios de reservas...');
  try {
    const now = new Date();
    
    // Obtener fecha de mañana (now + 24 horas) en formato YYYY-MM-DD local
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${yyyy}-${mm}-${dd}`;

    console.log(`Buscando reservas para la fecha: ${tomorrowStr}`);

    const reservationsSnap = await admin.firestore().collection('reservations')
      .where('date', '==', tomorrowStr)
      .get();

    if (reservationsSnap.empty) {
      console.log('No se encontraron reservas para mañana.');
      return;
    }

    for (const doc of reservationsSnap.docs) {
      const r = doc.data();
      const docId = doc.id;

      if (r.reminderSent === true) {
        continue;
      }

      const toEmail = r.userEmail || null;
      if (!toEmail) {
        console.log(`Reserva ${docId} no tiene correo registrado.`);
        continue;
      }

      // Validar ventana de 12 a 36 horas para el inicio
      const reservationDateTime = new Date(`${r.date}T${r.startTime}:00`);
      const diffMs = reservationDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours >= 12 && diffHours <= 36) {
        console.log(`Enviando recordatorio de 24h para reserva ${docId} (${r.userName})`);
        
        try {
          const subject = `Recordatorio de tu Reserva: ${r.spaceName} 🗓️`;
          const body = `Te recordamos que tienes una reserva programada para mañana:\n\n` +
            `📍 Espacio: ${r.spaceName}\n` +
            `📅 Fecha: ${r.date}\n` +
            `⏰ Hora: ${r.startTime} - ${r.endTime}\n\n` +
            `Por favor, asegúrate de cumplir con el reglamento del uso de zonas comunes.\n\n` +
            `¡Que disfrutes tu espacio!`;

          await sendEmailHelper({
            recipientEmail: toEmail,
            tenantId: r.tenantId,
            subject,
            body,
            type: 'general'
          });

          // Marcar como enviado en Firestore
          await admin.firestore().collection('reservations').doc(docId).update({
            reminderSent: true
          });
          console.log(`Recordatorio enviado con éxito para la reserva ${docId}`);
        } catch (sendErr) {
          console.error(`Error enviando recordatorio para reserva ${docId}:`, sendErr);
        }
      }
    }
  } catch (err) {
    console.error('Error en recordatorios de reservas:', err);
  }
}

// Ejecutar cada 60 minutos
setInterval(checkReservationReminders, 60 * 60 * 1000);

// Ejecutar inicialmente a los 10 segundos del arranque
setTimeout(checkReservationReminders, 10000);

// ── Health Check ────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'ResidentePro Email Notifications (per-tenant)' });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor de correos activo en puerto ${PORT}`);
  });
}

module.exports = app;
