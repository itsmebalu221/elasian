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
  secretKeyLength: secretKey.length,
  envVarsPresent: {
    CASHFREE_APP_ID: !!process.env.CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY: !!process.env.CASHFREE_SECRET_KEY,
    CASHFREE_ENV: process.env.CASHFREE_ENV
  }
});

// Direct API call function (bypassing SDK for debugging)
export async function createOrderDirect(orderData) {
  const baseUrl = CASHFREE_MODE === 'production' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg';
  
  console.log('Making direct API call to:', baseUrl + '/orders');
  console.log('Using App ID:', appId.substring(0, 10) + '...');
  
  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': '2023-08-01',
      'x-client-id': appId,
      'x-client-secret': secretKey
    },
    body: JSON.stringify(orderData)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('Cashfree API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: data
    });
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.response = { status: response.status, data };
    throw error;
  }
  
  return { data };
}

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
