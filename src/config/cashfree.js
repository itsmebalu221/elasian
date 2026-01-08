import { Cashfree as CashfreeSDK, CFEnvironment } from 'cashfree-pg';
import dotenv from 'dotenv';

dotenv.config();

// Determine active Cashfree mode based on configuration
const CASHFREE_MODE = process.env.CASHFREE_ENV === 'PRODUCTION'
  ? 'production'
  : 'sandbox';

// Initialize Cashfree with credentials (v5+ syntax)
const environment = CASHFREE_MODE === 'production'
  ? CFEnvironment.PRODUCTION
  : CFEnvironment.SANDBOX;

const cashfreeAppId = (process.env.CASHFREE_APP_ID || '').trim();
const cashfreeSecret = (process.env.CASHFREE_SECRET_KEY || '').trim();
const cashfreeApiVersion = (process.env.CASHFREE_API_VERSION || '').trim() || '2025-01-01';

if (!cashfreeAppId || !cashfreeSecret) {
  console.warn('⚠️  Cashfree credentials are missing. Payments will fail until CASHFREE_APP_ID and CASHFREE_SECRET_KEY are configured.');
}

const Cashfree = new CashfreeSDK(
  environment,
  cashfreeAppId,
  cashfreeSecret
);

Cashfree.XApiVersion = cashfreeApiVersion;

console.info(`💳 Cashfree initialized in ${CASHFREE_MODE.toUpperCase()} mode (API version ${Cashfree.XApiVersion}).`);

export const PAYMENT_AMOUNT = Number(process.env.PAYMENT_AMOUNT || 500);

export { Cashfree, CASHFREE_MODE };
