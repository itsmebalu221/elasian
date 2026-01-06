import { Cashfree as CashfreeSDK } from 'cashfree-pg';
import dotenv from 'dotenv';

dotenv.config();

// Determine active Cashfree mode based on configuration
const CASHFREE_MODE = process.env.CASHFREE_ENV === 'PRODUCTION'
  ? 'production'
  : 'sandbox';

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
