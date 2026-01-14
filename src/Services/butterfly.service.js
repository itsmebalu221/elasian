import crypto from 'crypto';
import QRCode from 'qrcode';
import db from '../db/mysql.js';

export const BUTTERFLY_AMOUNT = 1800;

function generateButterflyRegistrationId() {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `BUTTERFLY${year}${random}`;
}

// Generate QR code as data URL
async function generateQRCodeDataUrl(data) {
    try {
        return await QRCode.toDataURL(JSON.stringify(data), {
            width: 300,
            margin: 2,
            color: {
                dark: '#1f2433',
                light: '#ffffff'
            }
        });
    } catch (error) {
        console.error('QR code generation error:', error);
        return null;
    }
}

// Generate QR codes for all 4 students
export async function generateQRCodes(registration) {
    const qrCodes = [];

    for (let i = 1; i <= 4; i++) {
        const studentData = {
            type: 'BUTTERFLY',
            registrationId: registration.registration_id,
            studentNumber: i,
            name: registration[`student${i}_name`],
            rollNumber: registration[`student${i}_roll_number`],
            email: registration[`student${i}_email`]
        };

        const qrDataUrl = await generateQRCodeDataUrl(studentData);
        qrCodes.push({
            studentNumber: i,
            name: registration[`student${i}_name`],
            rollNumber: registration[`student${i}_roll_number`],
            qrCode: qrDataUrl
        });
    }

    return qrCodes;
}

export async function createButterflyRegistration(payload, primaryEmail) {
    const { student1, student2, student3, student4 } = payload;

    // Check if registration exists for this primary email
    const [existingRows] = await db.query(
        'SELECT * FROM butterfly_registrations WHERE primary_email = ?',
        [primaryEmail.toLowerCase().trim()]
    );

    if (existingRows.length > 0) {
        const existing = existingRows[0];

        if (existing.payment_status === 'PAID') {
            return {
                record: existing,
                isExisting: true,
                isPaid: true
            };
        }

        // Update existing unpaid registration
        await db.query(
            `UPDATE butterfly_registrations SET
        student1_name = ?, student1_branch = ?, student1_roll_number = ?, student1_mobile = ?, student1_email = ?,
        student2_name = ?, student2_branch = ?, student2_roll_number = ?, student2_mobile = ?, student2_email = ?,
        student3_name = ?, student3_branch = ?, student3_roll_number = ?, student3_mobile = ?, student3_email = ?,
        student4_name = ?, student4_branch = ?, student4_roll_number = ?, student4_mobile = ?, student4_email = ?,
        updated_at = NOW()
      WHERE id = ?`,
            [
                student1.name, student1.branch, student1.roll_number, student1.mobile, student1.email,
                student2.name, student2.branch, student2.roll_number, student2.mobile, student2.email,
                student3.name, student3.branch, student3.roll_number, student3.mobile, student3.email,
                student4.name, student4.branch, student4.roll_number, student4.mobile, student4.email,
                existing.id
            ]
        );

        const [updatedRows] = await db.query(
            'SELECT * FROM butterfly_registrations WHERE id = ?',
            [existing.id]
        );

        return {
            record: updatedRows[0],
            isExisting: true,
            isPaid: false
        };
    }

    // Create new registration
    const registrationId = generateButterflyRegistrationId();
    const [result] = await db.query(
        `INSERT INTO butterfly_registrations (
      registration_id,
      primary_email,
      student1_name, student1_branch, student1_roll_number, student1_mobile, student1_email,
      student2_name, student2_branch, student2_roll_number, student2_mobile, student2_email,
      student3_name, student3_branch, student3_roll_number, student3_mobile, student3_email,
      student4_name, student4_branch, student4_roll_number, student4_mobile, student4_email,
      total_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            registrationId,
            primaryEmail.toLowerCase().trim(),
            student1.name, student1.branch, student1.roll_number, student1.mobile, student1.email,
            student2.name, student2.branch, student2.roll_number, student2.mobile, student2.email,
            student3.name, student3.branch, student3.roll_number, student3.mobile, student3.email,
            student4.name, student4.branch, student4.roll_number, student4.mobile, student4.email,
            BUTTERFLY_AMOUNT
        ]
    );

    const [rows] = await db.query(
        'SELECT * FROM butterfly_registrations WHERE id = ?',
        [result.insertId]
    );

    return {
        record: rows[0],
        isExisting: false,
        isPaid: false
    };
}

export async function getButterflyRegistrationById(id) {
    const [rows] = await db.query(
        'SELECT * FROM butterfly_registrations WHERE id = ?',
        [id]
    );
    return rows[0] || null;
}

export async function getButterflyRegistrationByEmail(email) {
    const [rows] = await db.query(
        'SELECT * FROM butterfly_registrations WHERE primary_email = ? ORDER BY created_at DESC LIMIT 1',
        [email.toLowerCase().trim()]
    );
    return rows[0] || null;
}

export async function updateQRCodes(registrationId, qrCodes) {
    await db.query(
        'UPDATE butterfly_registrations SET qr_codes = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(qrCodes), registrationId]
    );
}
