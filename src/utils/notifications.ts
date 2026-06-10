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
    console.warn('⚠️ Firebase not initialized, cannot send push');
    return;
  }
  console.log(`🔔 Attempting to send push to user ${userId}: title="${title}"`);
  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('fcm_token')
    .eq('user_id', userId);
  if (error) {
    console.error('❌ Error fetching devices:', error);
    return;
  }
  if (!devices || devices.length === 0) {
    console.log(`ℹ️ No devices registered for user ${userId}`);
    return;
  }
  console.log(`📱 Found ${devices.length} devices for user ${userId}`);
  for (const device of devices) {
    try {
      await admin.messaging().send({
        token: device.fcm_token,
        notification: { title, body },
        data: data || {},
      });
      console.log(`✅ Push sent to token: ${device.fcm_token.substring(0, 10)}...`);
    } catch (err) {
      console.error('❌ Failed to send push:', err);
    }
  }
};