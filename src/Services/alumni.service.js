import crypto from 'crypto';
import db from '../db/mysql.js';

export const ALUMNI_AMOUNT = 800;

function generateAlumniRegistrationId() {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `ELYSIANA${year}${random}`;
}

export async function createAlumniRegistration(payload) {
    const {
        full_name,
        email,
        mobile,
        branch,
        year_of_graduation
    } = payload;

    const totalAmount = ALUMNI_AMOUNT;

    // Check for existing registration by email
    const [existingRows] = await db.query(
        'SELECT * FROM alumni_registrations WHERE email = ?',
        [email.toLowerCase().trim()]
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
            `UPDATE alumni_registrations
       SET full_name = ?,
           mobile = ?,
           branch = ?,
           year_of_graduation = ?,
           total_amount = ?,
           updated_at = NOW()
       WHERE id = ?`,
            [
                full_name,
                mobile,
                branch.toUpperCase(),
                year_of_graduation,
                totalAmount,
                existing.id
            ]
        );

        const [updatedRows] = await db.query(
            'SELECT * FROM alumni_registrations WHERE id = ?',
            [existing.id]
        );

        return {
            record: updatedRows[0],
            isExisting: true,
            isPaid: false
        };
    }

    // Create new registration
    const registrationId = generateAlumniRegistrationId();
    const [result] = await db.query(
        `INSERT INTO alumni_registrations (
      registration_id,
      full_name,
      email,
      mobile,
      branch,
      year_of_graduation,
      total_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            registrationId,
            full_name,
            email.toLowerCase().trim(),
            mobile,
            branch.toUpperCase(),
            year_of_graduation,
            totalAmount
        ]
    );

    const [rows] = await db.query(
        'SELECT * FROM alumni_registrations WHERE id = ?',
        [result.insertId]
    );

    return {
        record: rows[0],
        isExisting: false,
        isPaid: false
    };
}

export async function getAlumniRegistrationById(id) {
    const [rows] = await db.query(
        'SELECT * FROM alumni_registrations WHERE id = ?',
        [id]
    );
    return rows[0] || null;
}

export async function getAlumniRegistrationByCode(registrationId) {
    const [rows] = await db.query(
        'SELECT * FROM alumni_registrations WHERE registration_id = ?',
        [registrationId]
    );
    return rows[0] || null;
}

export async function getAlumniRegistrationByEmail(email) {
    const [rows] = await db.query(
        'SELECT * FROM alumni_registrations WHERE email = ? ORDER BY created_at DESC LIMIT 1',
        [email.toLowerCase().trim()]
    );
    return rows[0] || null;
}
