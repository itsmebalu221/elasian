import { Cashfree as CashfreeSDK } from 'cashfree-pg';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Cashfree with credentials (v5+ syntax)
const environment = process.env.CASHFREE_ENV === 'PRODUCTION' 
  ? CashfreeSDK.PRODUCTION 
  : CashfreeSDK.SANDBOX;

const Cashfree = new CashfreeSDK(
  environment,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

export const PAYMENT_AMOUNT = 500; // ₹500 for event pass

export { Cashfree };
