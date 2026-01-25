import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306')
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function generateQRCodeUrl(registrationId, size = 200) {
  if (!registrationId) return '';
  const encodedData = encodeURIComponent(registrationId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&bgcolor=ffffff&color=000000`;
}

function buildEmailHtml(name, registrationId, userType) {
  const qrCodeUrl = generateQRCodeUrl(registrationId);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elysian '26 - Event Pass</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 300; letter-spacing: 4px;">elysian'26</h1>
              <p style="margin: 10px 0 0 0; color: #a8a9ad; font-size: 14px;">Technical & Cultural Fest</p>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background-color: #22c55e; padding: 15px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                ✓ Your Event Pass is Ready!
              </p>
            </td>
          </tr>

          <!-- QR Code Section -->
          <tr>
            <td style="padding: 30px; text-align: center; border-bottom: 1px solid #eee;">
              <p style="margin: 0 0 15px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Event Pass QR Code</p>
              <img src="${qrCodeUrl}" alt="QR Code" width="180" height="180" style="border: 4px solid #1a1a2e; border-radius: 8px;">
              <p style="margin: 15px 0 0 0; font-size: 24px; font-weight: 700; color: #1a1a2e; letter-spacing: 2px;">${registrationId}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">Registration ID</p>
            </td>
          </tr>

          <!-- Pass Details -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px;">Pass Details</h2>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;">Name</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Registration ID</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${registrationId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Pass Type</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${userType || 'Event Pass'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Instructions -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #1a1a2e; font-size: 14px;">📱 How to use your pass:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 13px; line-height: 1.8;">
                  <li>Save this email or take a screenshot of the QR code</li>
                  <li>Present the QR code at the event entrance</li>
                  <li>Our team will scan and verify your registration</li>
                </ol>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #888; font-size: 12px;">
                © 2026 Elysian - HITAM. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 11px;">
                Questions? Reply to this email or contact us at support@elysianhitam.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

async function sendEmail(email, name, registrationId, userType) {
  try {
    const html = buildEmailHtml(name, registrationId, userType);
    const info = await transporter.sendMail({
      from: 'test@elysianhitam.com',
      to: email,
      subject: `Elysian'26 - Your Event Pass (${registrationId})`,
      text: `Hi ${name},\n\nYour Elysian'26 event pass is ready!\n\nRegistration ID: ${registrationId}\n\nPlease show this QR code at the event entrance.\n\nThank you!`,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  console.log('Connected to database');

  // Get flash registrations (paid)
  const [flashRows] = await conn.query(
    `SELECT registration_id, full_name, email FROM flash_registrations WHERE payment_status = 'SUCCESS' AND registration_id IS NOT NULL`
  );
  console.log(`Found ${flashRows.length} flash registrations`);

  // Get first phase registrations
  const [firstPhaseRows] = await conn.query(
    `SELECT registration_id, full_name, email, user_type FROM first_phase_registrations WHERE registration_id IS NOT NULL`
  );
  console.log(`Found ${firstPhaseRows.length} first phase registrations`);

  let successCount = 0;
  let failCount = 0;

  // Send to flash registrations
  console.log('\n--- Sending to Flash Registrations ---');
  for (const row of flashRows) {
    const result = await sendEmail(row.email, row.full_name, row.registration_id, 'Flash Sale Pass');
    if (result.success) {
      console.log(`✓ Sent to ${row.email} (${row.registration_id})`);
      successCount++;
    } else {
      console.log(`✗ Failed ${row.email}: ${result.error}`);
      failCount++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Send to first phase registrations
  console.log('\n--- Sending to First Phase Registrations ---');
  for (const row of firstPhaseRows) {
    const passType = row.user_type === 'ALUMNI' ? 'Alumni Pass' : row.user_type === 'EXTERNAL' ? 'External Pass' : 'Student Pass';
    const result = await sendEmail(row.email, row.full_name, row.registration_id, passType);
    if (result.success) {
      console.log(`✓ Sent to ${row.email} (${row.registration_id})`);
      successCount++;
    } else {
      console.log(`✗ Failed ${row.email}: ${result.error}`);
      failCount++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total sent: ${successCount}`);
  console.log(`Total failed: ${failCount}`);

  await conn.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
