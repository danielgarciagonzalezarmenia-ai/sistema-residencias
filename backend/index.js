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

// ── Nodemailer (Gmail) ──────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,       // ej: residenciaspro@gmail.com
    pass: process.env.GMAIL_APP_PASS,   // contraseña de aplicación de Google
  },
});

// Verificar conexión SMTP al iniciar
transporter.verify().then(() => {
  console.log('✅ Conexión SMTP con Gmail exitosa');
}).catch((err) => {
  console.error('❌ Error conectando a Gmail SMTP:', err.message);
});

// ── Endpoint: Enviar notificación por correo ────────────
app.post('/send-email', async (req, res) => {
  try {
    const { recipientId, tenantId, subject, body, type } = req.body;

    if (!recipientId || !subject || !body) {
      return res.status(400).json({ error: 'Faltan parámetros: recipientId, subject, body' });
    }

    let recipientEmail = null;
    let recipientName = '';

    // Si es para el ADMIN del tenant
    if (recipientId === 'ADMIN') {
      if (!tenantId) return res.status(400).json({ error: 'Falta tenantId para notificar al Admin' });
      const adminSnap = await admin.firestore().collection('users')
        .where('tenantId', '==', tenantId)
        .where('role', '==', 'ADMINISTRADOR')
        .limit(1)
        .get();
      if (!adminSnap.empty) {
        const adminData = adminSnap.docs[0].data();
        recipientEmail = adminData.email;
        recipientName = `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim();
      }
    } else {
      // Buscar directamente al usuario
      const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        recipientEmail = userData.email;
        recipientName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      }
    }

    if (!recipientEmail) {
      return res.status(404).json({ error: 'No se encontró el correo del destinatario' });
    }

    // Obtener nombre del conjunto
    let tenantNameLabel = 'Tu Conjunto Residencial';
    if (tenantId) {
      const tenantDoc = await admin.firestore().collection('tenants').doc(tenantId).get();
      if (tenantDoc.exists) {
        tenantNameLabel = tenantDoc.data().name || tenantNameLabel;
      }
    }

    // Elegir icono según tipo
    const typeIcons = {
      package: '📦',
      announcement: '📢',
      pqrs: '📋',
      payment: '💰',
      general: '🔔',
    };
    const icon = typeIcons[type] || '🔔';

    // HTML del correo
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; background-color:#09090b; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#18181b; border-radius:16px; overflow:hidden; border:1px solid #27272a;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding:28px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">
                          Residente<span style="color:#c4b5fd;">Pro</span>
                        </h1>
                        <p style="margin:4px 0 0; color:#ddd6fe; font-size:12px; font-weight:500;">
                          ${tenantNameLabel}
                        </p>
                      </td>
                      <td align="right" style="font-size:36px;">
                        ${icon}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 16px; color:#fafafa; font-size:18px; font-weight:600;">
                    ${subject}
                  </h2>
                  <p style="margin:0 0 24px; color:#a1a1aa; font-size:14px; line-height:1.7;">
                    ${body}
                  </p>
                  <a href="https://danielgarciagonzalezarmenia-ai.github.io/sistema-residencias/dashboard"
                     style="display:inline-block; background-color:#7c3aed; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:600;">
                    Ir a ResidentePro →
                  </a>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 32px; border-top:1px solid #27272a;">
                  <p style="margin:0; color:#52525b; font-size:11px; text-align:center;">
                    Este correo fue enviado automáticamente por ResidentePro.<br/>
                    Si no reconoces esta notificación, ignora este mensaje.
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
      from: `"ResidentePro 🏢" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `${icon} ${subject} — ResidentePro`,
      html: htmlContent,
    });

    console.log(`📧 Correo enviado a ${recipientEmail}: ${info.messageId}`);
    res.status(200).json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    res.status(500).json({ error: 'Error al enviar el correo', details: error.message });
  }
});

// ── Health Check ────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'ResidentePro Email Notifications' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de correos activo en puerto ${PORT}`);
});
