import { google } from 'googleapis';
import { googlePlayConfig } from '../config/googlePlay';
import logger from '../utils/logger';

// ==========================================
// 1️⃣ REAL GOOGLE API SETUP
// ==========================================
let auth: any = null;
let androidPublisher: any = null;

// ✅ Real mode ke liye auth initialize karo
const initRealGoogleClient = () => {
  if (!googlePlayConfig.enabled || googlePlayConfig.mockMode) return null;
  if (auth) return androidPublisher; // Already initialized

  try {
    auth = new google.auth.JWT({
      email: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL!,
      key: process.env.GOOGLE_PLAY_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    androidPublisher = google.androidpublisher({
      version: 'v3',
      auth,
    });
    logger.info('✅ Google Play Real client initialized');
    return androidPublisher;
  } catch (err) {
    logger.error('❌ Failed to initialize Google Play client:', err);
    return null;
  }
};

// ==========================================
// 2️⃣ REAL VERIFICATION FUNCTIONS
// ==========================================
const verifyRealPurchase = async (productId: string, purchaseToken: string, isSubscription: boolean) => {
  const client = initRealGoogleClient();
  if (!client) {
    return { isValid: false, error: 'Google client not initialized' };
  }

  try {
    let response;
    if (isSubscription) {
      response = await client.purchases.subscriptions.get({
        packageName: googlePlayConfig.packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });
    } else {
      response = await client.purchases.products.get({
        packageName: googlePlayConfig.packageName,
        productId: productId,
        token: purchaseToken,
      });
    }

    const data = response.data;
    // Subscription: paymentState 1 = Paid, 2 = Pending, 3 = Free trial
    // Product: purchaseState 0 = Purchased, 1 = Canceled, 2 = Pending
    const isValid = isSubscription ? data.paymentState === 1 : data.purchaseState === 0;

    return {
      isValid,
      purchaseState: data.purchaseState,
      orderId: data.orderId,
      purchaseTime: data.purchaseTime,
      expiryTime: data.expiryTimeMillis || null,
      autoRenewing: data.autoRenewing || false,
      consumptionState: data.consumptionState,
      priceAmountMicros: data.priceAmountMicros,
    };
  } catch (error: any) {
    logger.error('Google Play verification failed:', error);
    return { isValid: false, error: error.message };
  }
};

// ==========================================
// 3️⃣ REAL ACKNOWLEDGE FUNCTIONS
// ==========================================
const acknowledgeRealPurchase = async (productId: string, purchaseToken: string, isSubscription: boolean) => {
  const client = initRealGoogleClient();
  if (!client) return { success: false, error: 'Client not initialized' };

  try {
    if (isSubscription) {
      await client.purchases.subscriptions.acknowledge({
        packageName: googlePlayConfig.packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });
    } else {
      await client.purchases.products.acknowledge({
        packageName: googlePlayConfig.packageName,
        productId: productId,
        token: purchaseToken,
      });
    }
    return { success: true };
  } catch (error) {
    logger.error('Acknowledge failed:', error);
    return { success: false };
  }
};

// ==========================================
// 4️⃣ MOCK FUNCTIONS (Fallback)
// ==========================================
const generateMockPurchaseResponse = (productId: string, isSubscription: boolean) => {
  const now = new Date();
  const expiryDate = new Date();
  if (isSubscription) {
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  } else {
    expiryDate.setDate(expiryDate.getDate() + 365);
  }

  return {
    isValid: true,
    purchaseState: 0,
    orderId: `mock_order_${Date.now()}`,
    purchaseTime: now.getTime(),
    expiryTime: expiryDate.getTime(),
    autoRenewing: true,
    consumptionState: isSubscription ? undefined : 0,
    priceAmountMicros: 99900000,
  };
};

// ==========================================
// 5️⃣ EXPORTED MAIN FUNCTIONS
// ==========================================
export const verifyPurchase = async (
  productId: string,
  purchaseToken: string,
  isSubscription: boolean
) => {
  // 🟢 MOCK MODE
  if (googlePlayConfig.mockMode || !googlePlayConfig.enabled) {
    logger.info(`🔄 MOCK: Verifying purchase for ${productId}`);
    return {
      ...generateMockPurchaseResponse(productId, isSubscription),
      _mock: true,
    };
  }

  // 🔴 REAL MODE
  logger.info(`🔴 REAL: Verifying purchase for ${productId}`);
  return await verifyRealPurchase(productId, purchaseToken, isSubscription);
};

export const acknowledgePurchase = async (
  productId: string,
  purchaseToken: string,
  isSubscription: boolean
) => {
  // 🟢 MOCK MODE
  if (googlePlayConfig.mockMode || !googlePlayConfig.enabled) {
    logger.info(`✅ MOCK: Purchase acknowledged for ${productId}`);
    return { success: true };
  }

  // 🔴 REAL MODE
  logger.info(`✅ REAL: Acknowledging purchase for ${productId}`);
  return await acknowledgeRealPurchase(productId, purchaseToken, isSubscription);
};