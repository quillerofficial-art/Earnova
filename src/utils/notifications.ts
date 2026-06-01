import admin from 'firebase-admin';
import { supabase } from '../config/supabase';

let initialized = false;

export const initFirebase = () => {
  if (!initialized && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString();
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
  }
};

export const sendPushNotification = async (userId: string, title: string, body: string, data?: any) => {
  if (!initialized) {
    console.warn('Firebase not initialized, cannot send push');
    return;
  }
  // Fetch user's FCM tokens
  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('fcm_token')
    .eq('user_id', userId);
  if (error || !devices || devices.length === 0) return;

  const messages = devices.map(device => ({
    token: device.fcm_token,
    notification: { title, body },
    data: data || {},
  }));

  for (const msg of messages) {
    try {
      await admin.messaging().send(msg);
    } catch (err) {
      console.error('Failed to send push to device:', err);
    }
  }
};