import { sendBulkRegistrationQrEmails, sendButterflyConfirmationEmailsByCode } from '../Services/email.service.js';

const ALLOWED_TABLES = ['attendance_snapshot', 'flash_registrations', 'first_phase_registrations'];

function getAdminToken(req) {
  const headerToken = req.headers['x-admin-token'];
  if (headerToken) return headerToken.toString().trim();

  const queryToken = req.query?.token;
  if (queryToken) return queryToken.toString().trim();

  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

function isAuthorized(req) {
  const expected = process.env.ADMIN_BULK_EMAIL_TOKEN || '';
  if (!expected) return false;
  const token = getAdminToken(req);
  return token && token === expected;
}

export async function sendBulkQrEmails(req, res) {
  try {
    if (!process.env.ADMIN_BULK_EMAIL_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'ADMIN_BULK_EMAIL_TOKEN is not configured'
      });
    }

    if (!isAuthorized(req)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const payload = req.method === 'GET' ? req.query || {} : req.body || {};
    const { tables, onlyPaid = true, limit = null, dryRun = false, testEmail = null } = payload;

    const normalizedTables = Array.isArray(tables)
      ? tables
      : typeof tables === 'string'
        ? tables.split(',').map(t => t.trim()).filter(Boolean)
        : tables
          ? [tables]
          : undefined;
    const filteredTables = normalizedTables
      ? normalizedTables.filter(table => ALLOWED_TABLES.includes(table))
      : undefined;

    const normalizedOnlyPaid = onlyPaid === 'false' || onlyPaid === false ? false : true;
    const normalizedDryRun = dryRun === 'true' || dryRun === true;
    const normalizedLimit = typeof limit === 'string' ? Number(limit) : limit;
    const normalizedTestEmail = testEmail ? testEmail.toString().trim() : null;

    const result = await sendBulkRegistrationQrEmails({
      tables: filteredTables,
      onlyPaid: normalizedOnlyPaid,
      limit: normalizedLimit,
      dryRun: normalizedDryRun,
      testEmail: normalizedTestEmail
    });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Bulk QR email error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function sendButterflyEmailsByCode(req, res) {
  try {
    if (!process.env.ADMIN_BULK_EMAIL_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'ADMIN_BULK_EMAIL_TOKEN is not configured'
      });
    }

    if (!isAuthorized(req)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const payload = req.method === 'GET' ? req.query || {} : req.body || {};
    const registrationId = payload.registrationId || payload.registration_id || payload.id;

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        error: 'registrationId is required'
      });
    }

    const result = await sendButterflyConfirmationEmailsByCode(registrationId.toString().trim());

    return res.json({
      success: !!result?.success,
      result
    });
  } catch (error) {
    console.error('Butterfly QR email error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
