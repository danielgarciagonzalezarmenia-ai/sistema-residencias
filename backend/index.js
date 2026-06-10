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

// ── Crear transporter dinámico por tenant ───────────────
async function getTransporterForTenant(tenantId) {
  const tenantDoc = await admin.firestore().collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) {
    throw new Error('Conjunto no encontrado');
  }

  const tenantData = tenantDoc.data();
  if (!tenantData.smtpEmail || !tenantData.smtpPassword) {
    throw new Error('El administrador no ha configurado el correo de notificaciones. Ve a Configuración > Correo de Notificaciones.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: tenantData.smtpEmail,
      pass: tenantData.smtpPassword,
    },
  });

  return { transporter, senderEmail: tenantData.smtpEmail, tenantName: tenantData.name || 'Tu Conjunto' };
}

// ── Endpoint: Enviar correo ─────────────────────────────
app.post('/send-email', async (req, res) => {
  try {
    const { recipientId, recipientEmail, tenantId, subject, body, type, metadata = {} } = req.body;

    if (!tenantId || !subject || !body) {
      return res.status(400).json({ error: 'Faltan parámetros: tenantId, subject, body' });
    }

    // Obtener transporter del tenant
    let transporterInfo;
    try {
      transporterInfo = await getTransporterForTenant(tenantId);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { transporter, senderEmail, tenantName } = transporterInfo;

    // Determinar el email del destinatario
    let toEmail = recipientEmail || null;
    let toName = '';

    if (!toEmail && recipientId) {
      if (recipientId === 'ADMIN') {
        // Buscar al administrador
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
      return res.status(404).json({ error: 'No se encontró el correo del destinatario' });
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
      // General/Personal/PQRS/Payment
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

    // Enviar correo
    const info = await transporter.sendMail({
      from: `"${tenantName} — ResidentePro 🏢" <${senderEmail}>`,
      to: toEmail,
      subject: `${config.icon} ${subject}`,
      html: htmlContent,
    });

    console.log(`📧 Correo enviado a ${toEmail} desde ${senderEmail}: ${info.messageId}`);
    res.status(200).json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    res.status(500).json({ error: 'Error al enviar el correo', details: error.message });
  }
});

// ── Health Check ────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'ResidentePro Email Notifications (per-tenant)' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de correos activo en puerto ${PORT}`);
});
