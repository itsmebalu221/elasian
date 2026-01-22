import { admitSelection, getCheckinConfig, lookupPass, CheckinError } from '../Services/checkin.service.js';

function handleError(res, error) {
  const status = error instanceof CheckinError ? error.status : 500;
  const code = error instanceof CheckinError ? error.code : 'CHECKIN_ERROR';

  console.error('Check-in error:', code, error.message);
  return res.status(status).json({
    success: false,
    error: error.message,
    code
  });
}

export function fetchConfig(req, res) {
  const config = getCheckinConfig();
  return res.json({
    success: true,
    config
  });
}

export async function lookupRegistration(req, res) {
  try {
    const { token, qr, registrationId, day } = req.body || {};
    const payload = token || qr || registrationId;
    const result = await lookupPass(payload, day);

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function admitGuests(req, res) {
  try {
    const { attendanceIds, day } = req.body || {};
    const operator = req.user?.email || 'system';
    const result = await admitSelection({ attendanceIds, dayId: day, operator });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    return handleError(res, error);
  }
}
