import db from '../db/mysql.js';

const DAY_OPTIONS = Array.from({ length: 7 }, (_, idx) => {
  const dayNumber = idx + 1;
  return { id: `day${dayNumber}`, label: `Day ${dayNumber}` };
});

const configuredDefaultDay = (process.env.CHECKIN_DEFAULT_DAY || '').toLowerCase().trim();
const DEFAULT_DAY = DAY_OPTIONS.find(option => option.id === configuredDefaultDay)?.id || DAY_OPTIONS[0].id;
const INSTITUTION_FILTER = (process.env.CHECKIN_EXTERNAL_INSTITUTION_FILTER || 'HITAM').trim().toLowerCase();

const SOURCE_TO_TYPE = {
  butterfly_registrations: 'BUTTERFLY',
  external_registrations: 'EXTERNAL',
  student_forms: 'INTERNAL',
  alumni_registrations: 'ALUMNI'
};

const STATUS_LABELS = {
  unattended: 'Not checked in',
  admitted: 'Admitted',
  rejected: 'Rejected',
  denied: 'Blocked'
};

const PASS_LABELS = {
  BUTTERFLY: 'Butterfly Pass',
  EXTERNAL: 'External (HITAM Only)',
  FIRST_PHASE: 'First Phase Registration'
};

export class CheckinError extends Error {
  constructor(message, status = 400, code = 'CHECKIN_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function resolveDay(dayId = DEFAULT_DAY) {
  const normalized = dayId?.toString().toLowerCase().trim();
  const fallback = DAY_OPTIONS[0];
  const option = DAY_OPTIONS.find(day => day.id === normalized);
  return option || fallback;
}

function extractRegistrationId(rawToken) {
  if (!rawToken) {
    return '';
  }

  const trimmed = rawToken.toString().trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const value = parsed.registrationId || parsed.registration_id || parsed.id;
      if (value) {
        return value.toString().trim().toUpperCase();
      }
    } catch (_) {
      // Ignore malformed JSON payloads; fallback below.
    }
  }

  const butterflyMatch = trimmed.match(/(BUTTERFLY[0-9A-Z]+)/i);
  if (butterflyMatch) {
    return butterflyMatch[1].toUpperCase();
  }

  const externalMatch = trimmed.match(/(ELYSIANX[0-9A-Z]+)/i);
  if (externalMatch) {
    return externalMatch[1].toUpperCase();
  }

  return trimmed.toUpperCase();
}

function normalizeStatus(value) {
  return (value || 'unattended').toString().toLowerCase();
}

function buildHistory(snapshotRow) {
  if (!snapshotRow) {
    return null;
  }

  const history = {};
  for (const option of DAY_OPTIONS) {
    history[option.id] = snapshotRow[option.id] || 'unattended';
  }
  return history;
}

function findSnapshotForSlot(slot, snapshots) {
  return snapshots.find(row => {
    const rollMatch = slot.rollNumber && row.roll_number && slot.rollNumber.toLowerCase() === row.roll_number.toLowerCase();
    const emailMatch = slot.email && row.email && slot.email.toLowerCase() === row.email.toLowerCase();
    const nameMatch = slot.name && row.full_name && slot.name.toLowerCase() === row.full_name.toLowerCase();
    return rollMatch || emailMatch || nameMatch;
  }) || null;
}

function hydrateParticipant(baseSlot, snapshotRow, dayId, slotLabel) {
  const status = normalizeStatus(snapshotRow ? snapshotRow[dayId] : 'unattended');
  return {
    attendanceId: snapshotRow?.id || null,
    slotLabel,
    studentNumber: baseSlot.studentNumber || null,
    name: baseSlot.name,
    branch: baseSlot.branch || null,
    rollNumber: baseSlot.rollNumber || null,
    email: baseSlot.email || null,
    mobile: baseSlot.mobile || null,
    institution: baseSlot.institution || null,
    department: baseSlot.department || null,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    canAdmit: status === 'unattended' && !!snapshotRow?.id,
    history: buildHistory(snapshotRow)
  };
}

function mapButterflyParticipants(registration, snapshots, dayId) {
  const participants = [];
  
  // Snapshots are inserted in order: student1, student2, student3, student4
  // So we can match by index directly instead of trying to match by name/email
  for (let i = 1; i <= 4; i++) {
    const studentName = registration[`student${i}_name`];
    
    // Skip empty slots (some butterfly passes might have less than 4 students)
    if (!studentName || !studentName.trim()) {
      continue;
    }

    const baseSlot = {
      studentNumber: i,
      name: studentName,
      branch: registration[`student${i}_branch`],
      rollNumber: registration[`student${i}_roll_number`],
      mobile: registration[`student${i}_mobile`],
      email: registration[`student${i}_email`]
    };

    // Match snapshot by index (i-1 because array is 0-based)
    // Or fallback to name/email matching if order is uncertain
    let slotSnapshot = snapshots[i - 1] || null;
    
    // Verify this snapshot belongs to this student (sanity check)
    if (slotSnapshot) {
      const nameMatch = slotSnapshot.full_name?.toLowerCase().trim() === studentName.toLowerCase().trim();
      const rollMatch = baseSlot.rollNumber && slotSnapshot.roll_number && 
                        baseSlot.rollNumber.toLowerCase().trim() === slotSnapshot.roll_number.toLowerCase().trim();
      const emailMatch = baseSlot.email && slotSnapshot.email && 
                         baseSlot.email.toLowerCase().trim() === slotSnapshot.email.toLowerCase().trim();
      
      // If index doesn't match, try to find correct snapshot
      if (!nameMatch && !rollMatch && !emailMatch) {
        slotSnapshot = findSnapshotForSlot(baseSlot, snapshots);
      }
    } else {
      // Fallback to matching
      slotSnapshot = findSnapshotForSlot(baseSlot, snapshots);
    }

    participants.push(hydrateParticipant(baseSlot, slotSnapshot, dayId, `Guest ${i}`));
  }
  
  return participants;
}

function mapExternalParticipants(registration, snapshots, dayId) {
  // External passes are individual - 1 person per registration
  // There should be exactly 1 snapshot row for this registration
  if (!snapshots.length) {
    return [];
  }

  // Use the first (and typically only) snapshot
  const snapshot = snapshots[0];
  const baseSlot = {
    studentNumber: 1,
    name: registration.full_name,
    branch: null,
    rollNumber: registration.identity_number,
    mobile: registration.mobile,
    email: registration.email,
    institution: registration.institution,
    department: registration.department
  };

  return [hydrateParticipant(baseSlot, snapshot, dayId, 'Pass Holder')];
}

function summarizeParticipants(participants) {
  const summary = {
    total: participants.length,
    admitted: 0,
    pending: 0,
    blocked: 0,
    status: 'VALID'
  };

  for (const participant of participants) {
    if (participant.status === 'admitted') {
      summary.admitted += 1;
    } else if (participant.status === 'unattended') {
      summary.pending += 1;
    } else {
      summary.blocked += 1;
    }
  }

  if (summary.pending === 0 && summary.admitted > 0) {
    summary.status = 'ALREADY_USED';
  } else if (summary.pending > 0 && summary.admitted > 0) {
    summary.status = 'PARTIAL';
  }

  return summary;
}

function buildMeta(passType, registration, summary) {
  if (passType === 'BUTTERFLY') {
    return {
      passLabel: PASS_LABELS.BUTTERFLY,
      primaryEmail: registration.primary_email,
      paymentStatus: registration.payment_status,
      totalAmount: Number(registration.total_amount),
      counts: summary
    };
  }

  return {
    passLabel: PASS_LABELS.EXTERNAL,
    ownerName: registration.full_name,
    institution: registration.institution,
    department: registration.department,
    identityNumber: registration.identity_number,
    paymentStatus: registration.payment_status,
    totalAmount: Number(registration.total_amount),
    counts: summary
  };
}

async function fetchSnapshots(registrationId) {
  const [rows] = await db.query(
    'SELECT * FROM attendance_snapshot WHERE registration_id = ? ORDER BY id',
    [registrationId]
  );
  return rows;
}

async function fetchRegistration(table, id) {
  const [rows] = await db.query(
    `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function fetchFirstPhaseRegistration(registrationId) {
  const [rows] = await db.query(
    'SELECT * FROM first_phase_registrations WHERE registration_id = ? ORDER BY id',
    [registrationId]
  );
  return rows;
}

function mapFirstPhaseParticipants(registrations, dayId) {
  return registrations.map((reg, index) => {
    const status = normalizeStatus(reg[dayId]);
    return {
      attendanceId: reg.id,
      slotLabel: registrations.length === 1 ? 'Pass Holder' : `Participant ${index + 1}`,
      studentNumber: index + 1,
      name: reg.full_name,
      branch: reg.branch || null,
      rollNumber: reg.roll_number || null,
      email: reg.email || null,
      mobile: reg.mobile || null,
      institution: null,
      department: null,
      status,
      statusLabel: STATUS_LABELS[status] || status,
      canAdmit: status === 'unattended',
      history: buildHistory(reg)
    };
  });
}

function buildFirstPhaseMeta(registration, summary) {
  return {
    passLabel: PASS_LABELS.FIRST_PHASE,
    ownerName: registration.full_name,
    email: registration.email,
    rollNumber: registration.roll_number,
    counts: summary
  };
}

async function buildFirstPhasePayload(registrationId, dayId) {
  const day = resolveDay(dayId);
  const registrations = await fetchFirstPhaseRegistration(registrationId);

  if (!registrations.length) {
    return null; // Not found in first_phase_registrations either
  }

  const participants = mapFirstPhaseParticipants(registrations, day.id);
  const summary = summarizeParticipants(participants);
  const meta = buildFirstPhaseMeta(registrations[0], summary);
  const message = summary.pending
    ? `${summary.pending} participant(s) ready to admit`
    : summary.admitted === summary.total && summary.total > 0
      ? 'All participants already admitted'
      : 'No participants available to admit';

  return {
    status: summary.status,
    passType: 'FIRST_PHASE',
    registrationId,
    day: day.id,
    dayLabel: day.label,
    canAdmit: participants.some(p => p.canAdmit),
    participants,
    meta,
    message,
    scannedAt: new Date().toISOString()
  };
}

async function buildPayload(registrationId, dayId) {
  const day = resolveDay(dayId);
  const snapshots = await fetchSnapshots(registrationId);

  // If not found in attendance_snapshot, check first_phase_registrations
  if (!snapshots.length) {
    const firstPhasePayload = await buildFirstPhasePayload(registrationId, dayId);
    if (firstPhasePayload) {
      return firstPhasePayload;
    }
    throw new CheckinError('Registration not found or not eligible for this gate', 404, 'NOT_FOUND');
  }

  const sourceTable = snapshots[0].source_table;
  const passType = SOURCE_TO_TYPE[sourceTable] || 'UNKNOWN';

  if (!['BUTTERFLY', 'EXTERNAL'].includes(passType)) {
    throw new CheckinError('Unsupported pass type for this validator', 400, 'UNSUPPORTED_PASS');
  }

  const registration = await fetchRegistration(sourceTable, snapshots[0].source_id);
  if (!registration) {
    throw new CheckinError('Registration data missing', 404, 'REGISTRATION_MISSING');
  }

  if (passType === 'EXTERNAL' && INSTITUTION_FILTER) {
    const institution = registration.institution || '';
    if (!institution.toLowerCase().includes(INSTITUTION_FILTER)) {
      throw new CheckinError('Only HITAM-only external passes can be validated here', 403, 'EXTERNAL_BLOCKED');
    }
  }

  const participants = passType === 'BUTTERFLY'
    ? mapButterflyParticipants(registration, snapshots, day.id)
    : mapExternalParticipants(registration, snapshots, day.id);

  const summary = summarizeParticipants(participants);
  const meta = buildMeta(passType, registration, summary);
  const message = summary.pending
    ? `${summary.pending} guest(s) ready to admit`
    : summary.admitted === summary.total && summary.total > 0
      ? 'All guests already admitted'
      : 'No guests available to admit';

  return {
    status: summary.status,
    passType,
    registrationId,
    day: day.id,
    dayLabel: day.label,
    canAdmit: participants.some(participant => participant.canAdmit),
    participants,
    meta,
    message,
    scannedAt: new Date().toISOString()
  };
}

export async function lookupPass(rawToken, dayId, { skipExtract = false } = {}) {
  const registrationId = skipExtract 
    ? rawToken?.toString().trim().toUpperCase() 
    : extractRegistrationId(rawToken);
  if (!registrationId) {
    throw new CheckinError('Registration ID is required', 400, 'TOKEN_MISSING');
  }

  return buildPayload(registrationId, dayId);
}

export async function admitSelection({ attendanceIds, dayId, operator, passType }) {
  const day = resolveDay(dayId);

  if (!Array.isArray(attendanceIds) || attendanceIds.length === 0) {
    throw new CheckinError('Select at least one guest to admit', 400, 'NO_SELECTION');
  }

  const uniqueIds = [...new Set(attendanceIds.map(Number).filter(id => !Number.isNaN(id)))];
  if (!uniqueIds.length) {
    throw new CheckinError('Selection was invalid', 400, 'INVALID_SELECTION');
  }

  const connection = await db.getConnection();
  const placeholders = uniqueIds.map(() => '?').join(',');

  // Determine which table to update based on passType
  const tableName = passType === 'FIRST_PHASE' ? 'first_phase_registrations' : 'attendance_snapshot';

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, registration_id, ${day.id} AS day_status FROM ${tableName} WHERE id IN (${placeholders}) FOR UPDATE`,
      uniqueIds
    );

    if (rows.length !== uniqueIds.length) {
      throw new CheckinError('One or more guests are missing from the log', 404, 'ATTENDEE_NOT_FOUND');
    }

    const registrationId = rows[0].registration_id;
    if (rows.some(row => row.registration_id !== registrationId)) {
      throw new CheckinError('Selections span multiple passes. Admit one pass at a time.', 400, 'MIXED_SELECTION');
    }

    const alreadyAdmitted = rows.filter(row => normalizeStatus(row.day_status) === 'admitted');
    if (alreadyAdmitted.length) {
      throw new CheckinError('Selected guest(s) already admitted', 409, 'ALREADY_ADMITTED');
    }

    await connection.query(
      `UPDATE ${tableName} SET ${day.id} = 'admitted', updated_at = NOW() WHERE id IN (${placeholders})`,
      uniqueIds
    );

    await connection.commit();

    console.log('✅ Check-in admit', {
      registrationId,
      day: day.id,
      count: uniqueIds.length,
      operator,
      passType,
      table: tableName
    });

    const payload = await buildPayload(registrationId, day.id);
    return {
      ...payload,
      message: `Admitted ${uniqueIds.length} guest(s)`
    };
  } catch (error) {
    await connection.rollback();
    if (error instanceof CheckinError) {
      throw error;
    }
    throw error;
  } finally {
    connection.release();
  }
}

export function getCheckinConfig() {
  return {
    dayOptions: DAY_OPTIONS,
    defaultDay: DEFAULT_DAY,
    timezone: process.env.TZ || 'Asia/Kolkata',
    filters: {
      externalInstitutionContains: INSTITUTION_FILTER || null
    },
    supportedPasses: ['BUTTERFLY', 'EXTERNAL', 'FIRST_PHASE']
  };
}
