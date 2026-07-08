import { googlePlayConfig } from '../config/googlePlay';
import logger from '../utils/logger';

// Mock Response Data
const generateMockPurchaseResponse = (productId: string, isSubscription: boolean) => {
  const now = new Date();
  const expiryDate = new Date();
  if (isSubscription) {
    expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month subscription
  } else {
    expiryDate.setDate(expiryDate.getDate() + 365); // 1 year for one-time (just example)
  }

  return {
    isValid: true,
    purchaseState: 0, // 0 = Purchased
    orderId: `mock_order_${Date.now()}`,
    purchaseTime: now.getTime(),
    expiryTime: expiryDate.getTime(),
    autoRenewing: true, // Mock auto-renew
    consumptionState: isSubscription ? undefined : 0,
    priceAmountMicros: 99900000, // $0.99 (dummy)
  };
};

// Real Verification (Abhi empty, baad mein implement karenge)
const verifyRealPurchase = async (productId: string, purchaseToken: string, isSubscription: boolean) => {
  // 🔒 Abhi ke liye fake hi return karo
  logger.warn('Real Google Play verification called, but returning mock (credentials missing)');
  return generateMockPurchaseResponse(productId, isSubscription);
};

/**
 * Main Purchase Verification Function
 * - Mock mode: Always returns success
 * - Real mode: Calls Google API (will implement later)
 */
export const verifyPurchase = async (
  productId: string,
  purchaseToken: string,
  isSubscription: boolean
) => {
  if (!googlePlayConfig.enabled || googlePlayConfig.mockMode) {
    logger.info(`🔄 Google Play MOCK: Verifying purchase for ${productId}`);
    return {
      ...generateMockPurchaseResponse(productId, isSubscription),
      _mock: true,
    };
  }

  // 🔥 Real Google API Call (Aaj nahi, baad mein implement karenge)
  // Google API setup: google.auth.JWT + androidPublisher.purchases.products.get()
  // Abhi hum log fake hi return kar rahe hain taaki app crash na ho.
  logger.warn('Real mode enabled but credentials not fully set up. Returning mock.');
  return generateMockPurchaseResponse(productId, isSubscription);
};

/**
 * Acknowledge Purchase (Mock)
 */
export const acknowledgePurchase = async (productId: string, purchaseToken: string) => {
  if (googlePlayConfig.mockMode) {
    logger.info(`✅ MOCK: Purchase acknowledged for ${productId}`);
    return { success: true };
  }
  // Real acknowledge logic later
  return { success: true };
};