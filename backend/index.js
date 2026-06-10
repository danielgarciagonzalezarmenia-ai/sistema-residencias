const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Load service account from environment variable (Render) or local file (Fallback)
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
  console.log('Firebase Admin Initialized Successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
}

app.post('/send-notification', async (req, res) => {
  try {
    const { recipientId, title, body, tenantId } = req.body;

    if (!recipientId || !title || !body) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    let fcmToken = null;

    if (recipientId === 'ADMIN') {
      if (!tenantId) return res.status(400).json({ error: 'Missing tenantId for ADMIN' });
      // Buscar al administrador de este tenant
      const adminSnapshot = await admin.firestore().collection('users')
        .where('tenantId', '==', tenantId)
        .where('role', '==', 'ADMINISTRADOR')
        .limit(1)
        .get();
      
      if (!adminSnapshot.empty) {
        fcmToken = adminSnapshot.docs[0].data().fcmToken;
      }
    } else {
      // Obtener token directo desde Firestore
      const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
      if (userDoc.exists) {
        fcmToken = userDoc.data().fcmToken;
      }
    }

    if (!fcmToken) {
      return res.status(400).json({ error: 'User does not have an FCM token' });
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
