import { Cashfree as CashfreeSDK } from 'cashfree-pg';
import dotenv from 'dotenv';

dotenv.config();

// Determine active Cashfree mode based on configuration
const CASHFREE_MODE = process.env.CASHFREE_ENV === 'PRODUCTION'
  ? 'production'
  : 'sandbox';

// Log credentials info for debugging (masked)
const appId = process.env.CASHFREE_APP_ID || '';
const secretKey = process.env.CASHFREE_SECRET_KEY || '';
console.log('Cashfree Config:', {
  mode: CASHFREE_MODE,
  appIdLength: appId.length,
  appIdPrefix: appId.substring(0, 8) + '...',
  secretKeyPrefix: secretKey.substring(0, 15) + '...',
  secretKeyLength: secretKey.length
});

// Initialize Cashfree SDK v5+ using static configuration
CashfreeSDK.XClientId = process.env.CASHFREE_APP_ID;
CashfreeSDK.XClientSecret = process.env.CASHFREE_SECRET_KEY;
CashfreeSDK.XEnvironment = CASHFREE_MODE === 'production' 
  ? CashfreeSDK.Environment.PRODUCTION 
  : CashfreeSDK.Environment.SANDBOX;

// Export the configured SDK class
const Cashfree = CashfreeSDK;

export const PAYMENT_AMOUNT = 500; // ₹500 for event pass

export { Cashfree, CASHFREE_MODE };
