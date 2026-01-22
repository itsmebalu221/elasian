import nodemailer from 'nodemailer';
import db from '../db/mysql.js';

// Create transporter
const createTransporter = () => {
  // Use environment variables for SMTP configuration
  // For Gmail: use App Password, not regular password
  // For other services: use appropriate SMTP settings
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Generate QR code URL
function generateQRCodeUrl(registrationId, size = 200) {
  if (!registrationId) return '';
  const encodedData = encodeURIComponent(registrationId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&bgcolor=ffffff&color=000000`;
}

// Format events list for email
async function formatEventsList(selectedEvents = []) {
  if (!selectedEvents || selectedEvents.length === 0) {
    return 'No specific events selected';
  }

  try {
    // Fetch event details from database
    const placeholders = selectedEvents.map(() => '?').join(',');
    const [events] = await db.query(
      `SELECT id, name, type, day_label, start_time, end_time FROM events WHERE id IN (${placeholders})`,
      selectedEvents
    );

    if (events.length === 0) {
      return 'Events to be announced';
    }

    return events.map(event => {
      const schedule = [event.day_label, event.start_time].filter(Boolean).join(' - ');
      return `• ${event.name}${schedule ? ` (${schedule})` : ''}`;
    }).join('\n');
  } catch (error) {
    console.error('Error formatting events:', error);
    return 'See your dashboard for event details';
  }
}

// Send confirmation email after successful payment
export async function sendPaymentConfirmationEmail({
  email,
  name,
  mobile,
  registrationId,
  selectedEvents = [],
  amount,
  isExternal = false,
  institution = null,
  orderId = null
}) {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP not configured. Skipping confirmation email.');
      return { success: false, reason: 'SMTP not configured' };
    }

    const transporter = createTransporter();
    const qrCodeUrl = generateQRCodeUrl(registrationId);
    const eventsList = await formatEventsList(selectedEvents);
    const dashboardUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html`;

    // Simple HTML email template
    const htmlContent = `
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
                ✓ Payment Successful - Your Pass is Confirmed!
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
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Mobile</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${mobile}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Email</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${email}</td>
                </tr>
                ${isExternal && institution ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Institution</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${institution}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Amount Paid</td>
                  <td style="padding: 8px 0; color: #22c55e; font-size: 14px; font-weight: 600;">₹${amount}</td>
                </tr>
                ${orderId ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Order ID</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 12px;">${orderId}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Registered Events -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px;">Registered Events</h2>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; font-size: 14px; color: #333; white-space: pre-line; line-height: 1.8;">${eventsList}</div>
            </td>
          </tr>

          <!-- Instructions -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px;">Important Instructions</h2>
              <ul style="margin: 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Carry this email or show the QR code on your phone at the entrance</li>
                <li>Bring a valid ID proof (College ID / Government ID)</li>
                <li>Arrive at least 15 minutes before your event starts</li>
                <li>This pass is non-transferable and valid for registered events only</li>
                <li>Follow the venue guidelines and event coordinators' instructions</li>
              </ul>
            </td>
          </tr>

          <!-- Dashboard Link -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #6b8cce 0%, #5a7bc0 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Your Dashboard</a>
              <p style="margin: 15px 0 0 0; color: #888; font-size: 12px;">Download your pass anytime from the dashboard</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 25px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #a8a9ad; font-size: 14px;">Need help? Contact us at</p>
              <a href="mailto:elysian@hitam.org" style="color: #6b8cce; text-decoration: none; font-size: 14px;">elysian@hitam.org</a>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 12px;">© 2026 Elysian - HITAM Technical Fest</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Plain text version
    const textContent = `
ELYSIAN '26 - EVENT PASS CONFIRMED
===================================

Payment Successful! Your pass is ready.

REGISTRATION ID: ${registrationId}

PASS DETAILS
------------
Name: ${name}
Mobile: ${mobile}
Email: ${email}
${isExternal && institution ? `Institution: ${institution}\n` : ''}Amount Paid: ₹${amount}
${orderId ? `Order ID: ${orderId}` : ''}

REGISTERED EVENTS
-----------------
${eventsList}

IMPORTANT INSTRUCTIONS
----------------------
• Carry this email or show the QR code on your phone at the entrance
• Bring a valid ID proof (College ID / Government ID)
• Arrive at least 15 minutes before your event starts
• This pass is non-transferable and valid for registered events only
• Follow the venue guidelines and event coordinators' instructions

View your dashboard: ${dashboardUrl}

---
Need help? Contact us at elysian@hitam.org
© 2026 Elysian - HITAM Technical Fest
    `.trim();

    const mailOptions = {
      from: `"Elysian '26" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `✓ Elysian '26 Pass Confirmed - ${registrationId}`,
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Confirmation email sent to ${email} - Message ID: ${info.messageId}`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
    return { success: false, error: error.message };
  }
}

// Helper to get registration details and send email
export async function sendConfirmationForPayment(orderId) {
  try {
    // Get payment details
    const [payments] = await db.query(
      'SELECT * FROM payments WHERE order_id = ?',
      [orderId]
    );

    if (payments.length === 0) {
      console.warn(`Payment not found for order: ${orderId}`);
      return { success: false, reason: 'Payment not found' };
    }

    const payment = payments[0];

    // Check if it's internal or external registration
    if (payment.form_id) {
      // Internal student
      const [forms] = await db.query(
        'SELECT sf.*, s.email FROM student_forms sf JOIN students s ON sf.student_id = s.id WHERE sf.id = ?',
        [payment.form_id]
      );

      if (forms.length === 0) {
        return { success: false, reason: 'Form not found' };
      }

      const form = forms[0];
      let selectedEvents = [];

      if (form.selected_events) {
        try {
          selectedEvents = typeof form.selected_events === 'string'
            ? JSON.parse(form.selected_events)
            : form.selected_events;
        } catch {
          selectedEvents = [];
        }
      }

      return sendPaymentConfirmationEmail({
        email: form.email,
        name: form.full_name,
        mobile: form.mobile,
        registrationId: form.registration_id,
        selectedEvents,
        amount: payment.amount,
        isExternal: false,
        orderId: payment.order_id
      });

    } else if (payment.external_registration_id) {
      // External participant
      const [externals] = await db.query(
        'SELECT * FROM external_registrations WHERE id = ?',
        [payment.external_registration_id]
      );

      if (externals.length === 0) {
        return { success: false, reason: 'External registration not found' };
      }

      const registration = externals[0];
      let selectedEvents = [];

      if (registration.selected_events) {
        try {
          selectedEvents = typeof registration.selected_events === 'string'
            ? JSON.parse(registration.selected_events)
            : registration.selected_events;
        } catch {
          selectedEvents = [];
        }
      }

      return sendPaymentConfirmationEmail({
        email: registration.email,
        name: registration.full_name,
        mobile: registration.mobile,
        registrationId: registration.registration_id,
        selectedEvents,
        amount: payment.amount,
        isExternal: true,
        institution: registration.institution,
        orderId: payment.order_id
      });
    } else if (payment.alumni_registration_id) {
      // Alumni participant
      const [alumni] = await db.query(
        'SELECT * FROM alumni_registrations WHERE id = ?',
        [payment.alumni_registration_id]
      );

      if (alumni.length === 0) {
        return { success: false, reason: 'Alumni registration not found' };
      }

      const registration = alumni[0];

      return sendPaymentConfirmationEmail({
        email: registration.email,
        name: registration.full_name,
        mobile: registration.mobile,
        registrationId: registration.registration_id,
        selectedEvents: [], // Alumni have all-day access, no specific events
        amount: payment.amount,
        isExternal: false, // Use internal styling
        orderId: payment.order_id
      });
    }

    return { success: false, reason: 'No associated registration found' };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
}

// Send confirmation emails to all 4 students in a butterfly registration
export async function sendButterflyConfirmationEmails(registrationId) {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP not configured. Skipping butterfly confirmation emails.');
      return { success: false, reason: 'SMTP not configured' };
    }

    // Get butterfly registration
    const [registrations] = await db.query(
      'SELECT * FROM butterfly_registrations WHERE id = ? AND payment_status = ?',
      [registrationId, 'PAID']
    );

    if (registrations.length === 0) {
      console.warn(`Butterfly registration not found or not paid: ${registrationId}`);
      return { success: false, reason: 'Registration not found or not paid' };
    }

    const reg = registrations[0];
    const transporter = createTransporter();
    const results = [];

    // Send email to each of the 4 students
    for (let i = 1; i <= 4; i++) {
      const studentName = reg[`student${i}_name`];
      const studentEmail = reg[`student${i}_email`];
      const studentRoll = reg[`student${i}_roll_number`];
      const studentBranch = reg[`student${i}_branch`];
      const studentQR = reg[`student${i}_qr_code`];

      if (!studentEmail) continue;

      // Generate QR code URL if stored QR is a data URL, otherwise use external service
      const qrCodeUrl = studentQR && studentQR.startsWith('data:image')
        ? studentQR
        : generateQRCodeUrl(`${reg.registration_id}-S${i}`);

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elysian '26 - Butterfly Pass</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4db03c 0%, #3a8a2e 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 300; letter-spacing: 4px;">elysian'26</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">🦋 Butterfly Group Pass</p>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background-color: #4db03c; padding: 15px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                ✓ Payment Successful - Your Pass is Ready!
              </p>
            </td>
          </tr>

          <!-- QR Code Section -->
          <tr>
            <td style="padding: 30px; text-align: center; border-bottom: 1px solid #eee;">
              <p style="margin: 0 0 15px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Event Pass QR Code</p>
              <img src="${qrCodeUrl}" alt="QR Code" width="180" height="180" style="border: 4px solid #4db03c; border-radius: 8px;">
              <p style="margin: 15px 0 0 0; font-size: 20px; font-weight: 700; color: #1a1a2e; letter-spacing: 2px;">${reg.registration_id}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">Group Registration ID</p>
            </td>
          </tr>

          <!-- Student Details -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #4db03c; font-size: 18px; border-bottom: 2px solid #4db03c; padding-bottom: 10px;">Your Pass Details</h2>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;">Name</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${studentName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Roll Number</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${studentRoll}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Branch</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${studentBranch}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Email</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">${studentEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Pass Type</td>
                  <td style="padding: 8px 0; color: #4db03c; font-size: 14px; font-weight: 600;">🦋 Butterfly Group (Student ${i} of 4)</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Group Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f0f9ed; padding: 15px; border-radius: 8px; border: 1px solid #d4edda;">
                <p style="margin: 0 0 10px 0; color: #4db03c; font-size: 14px; font-weight: 600;">🦋 Your Group Members</p>
                <p style="margin: 0; color: #555; font-size: 13px; line-height: 1.8;">
                  1. ${reg.student1_name} (${reg.student1_roll_number})<br>
                  2. ${reg.student2_name} (${reg.student2_roll_number})<br>
                  3. ${reg.student3_name} (${reg.student3_roll_number})<br>
                  4. ${reg.student4_name} (${reg.student4_roll_number})
                </p>
              </div>
            </td>
          </tr>

          <!-- Instructions -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px;">Important Instructions</h2>
              <ul style="margin: 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Show this QR code on your phone at the entrance</li>
                <li>Bring your College ID for verification</li>
                <li>Each group member must show their own QR code</li>
                <li>This pass grants access to all Elysian '26 events</li>
                <li>Follow venue guidelines and coordinators' instructions</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 25px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #a8a9ad; font-size: 14px;">Need help? Contact us at</p>
              <a href="mailto:elysian@hitam.org" style="color: #4db03c; text-decoration: none; font-size: 14px;">elysian@hitam.org</a>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 12px;">© 2026 Elysian - HITAM Technical Fest</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      const textContent = `
ELYSIAN '26 - BUTTERFLY GROUP PASS
===================================

Payment Successful! Your pass is ready.

GROUP REGISTRATION ID: ${reg.registration_id}

YOUR DETAILS
------------
Name: ${studentName}
Roll Number: ${studentRoll}
Branch: ${studentBranch}
Email: ${studentEmail}
Pass Type: Butterfly Group (Student ${i} of 4)

GROUP MEMBERS
-------------
1. ${reg.student1_name} (${reg.student1_roll_number})
2. ${reg.student2_name} (${reg.student2_roll_number})
3. ${reg.student3_name} (${reg.student3_roll_number})
4. ${reg.student4_name} (${reg.student4_roll_number})

IMPORTANT INSTRUCTIONS
----------------------
• Show your QR code on your phone at the entrance
• Bring your College ID for verification
• Each group member must show their own QR code
• This pass grants access to all Elysian '26 events
• Follow venue guidelines and coordinators' instructions

---
Need help? Contact us at elysian@hitam.org
© 2026 Elysian - HITAM Technical Fest
      `.trim();

      try {
        const mailOptions = {
          from: `"Elysian '26" <${process.env.SMTP_USER}>`,
          to: studentEmail,
          subject: `🦋 Elysian '26 Butterfly Pass - ${studentName}`,
          text: textContent,
          html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Butterfly email sent to ${studentEmail} (Student ${i}) - Message ID: ${info.messageId}`);
        results.push({ student: i, email: studentEmail, success: true, messageId: info.messageId });
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${studentEmail}:`, emailError.message);
        results.push({ student: i, email: studentEmail, success: false, error: emailError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📧 Butterfly emails: ${successCount}/4 sent successfully for registration ${reg.registration_id}`);

    return {
      success: successCount > 0,
      sentCount: successCount,
      totalCount: 4,
      results
    };
  } catch (error) {
    console.error('❌ Error sending butterfly confirmation emails:', error);
    return { success: false, error: error.message };
  }
}

