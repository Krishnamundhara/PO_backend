// services/emailService.js
// Configures Nodemailer and sends an email with the PDF attached

const nodemailer = require('nodemailer')

/**
 * Creates and returns a configured Nodemailer SMTP transporter.
 * Reads credentials from environment variables.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,                 // e.g. smtp.gmail.com
    port: parseInt(process.env.SMTP_PORT, 10),   // 587 for TLS
    secure: false,                               // false = STARTTLS (port 587)
    auth: {
      user: process.env.SMTP_USER,              // your Gmail address
      pass: process.env.SMTP_PASS               // Gmail App Password
    }
  })
}

/**
 * Sends an email with the PDF as an attachment.
 *
 * @param {Object} params
 * @param {string} params.poNumber    - The PO number (e.g. "PO123")
 * @param {string} params.partyName   - The party/customer name
 * @param {string} params.eventType   - "created" or "updated"
 * @param {Buffer} params.pdfBuffer   - The PDF file as a binary Buffer
 * @returns {Promise<void>}
 */
async function sendPOEmail({ poNumber, partyName, eventType = 'created', pdfBuffer }) {
  const transporter = createTransporter()

  // Verify SMTP connection before sending
  await transporter.verify()
  console.log('[emailService] SMTP connection verified.')

  // Build the email options
  const mailOptions = {
    from: `"PO System" <${process.env.SMTP_USER}>`,   // Sender name + address
    to: process.env.RECEIVER_EMAIL,                    // Fixed receiver from .env
    subject: `PO ${eventType === 'updated' ? 'Updated' : 'Created'} - ${poNumber}`,

    // Plain text body
    text: `
Purchase Order ${eventType === 'updated' ? 'Updated' : 'Created'}

PO Number  : ${poNumber}
Party Name : ${partyName}

Please find the PO PDF attached to this email.
    `.trim(),

    // HTML body (clean, readable)
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <h2 style="color: #1a73e8;">Purchase Order ${eventType === 'updated' ? 'Updated' : 'Created'}</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f5f5f5;">PO Number</td>
            <td style="padding: 8px 12px; border: 1px solid #ddd;">${poNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f5f5f5;">Party Name</td>
            <td style="padding: 8px 12px; border: 1px solid #ddd;">${partyName}</td>
          </tr>
        </table>
        <p style="margin-top: 16px; color: #555;">Please find the Purchase Order PDF attached to this email.</p>
      </div>
    `,

    // PDF attachment
    attachments: [
      {
        filename: `PO-${poNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  }

  // Send the email
  const info = await transporter.sendMail(mailOptions)
  console.log(`[emailService] Email sent! Message ID: ${info.messageId}`)
  return info
}

module.exports = { sendPOEmail }
