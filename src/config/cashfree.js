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

// Initialize Cashfree with credentials (v5+ syntax)
const environment = CASHFREE_MODE === 'production'
  ? CashfreeSDK.PRODUCTION
  : CashfreeSDK.SANDBOX;

const Cashfree = new CashfreeSDK(
  environment,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

export const PAYMENT_AMOUNT = 500; // ₹500 for event pass

export { Cashfree, CASHFREE_MODE };
