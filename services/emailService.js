// services/emailService.js
// Configures Nodemailer and sends an email with the PDF attached

const nodemailer = require('nodemailer')

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).toLowerCase() === 'true'
}

function parseNumber(value, defaultValue) {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

/**
 * Creates and returns a configured Nodemailer SMTP transporter.
 * Reads credentials from environment variables.
 */
function createTransporter() {
  const port = parseNumber(process.env.SMTP_PORT, 587)
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465)

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,                 // e.g. smtp.gmail.com
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,              // your Gmail address
      pass: process.env.SMTP_PASS               // Gmail App Password
    },
    // Keep SMTP failures short and visible in logs instead of hanging.
    connectionTimeout: parseNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 15000),
    greetingTimeout: parseNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: parseNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000)
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
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.RECEIVER_EMAIL) {
    throw new Error('Missing SMTP config. Required: SMTP_HOST, SMTP_USER, SMTP_PASS, RECEIVER_EMAIL')
  }

  const transporter = createTransporter()
  const shouldVerify = parseBoolean(process.env.SMTP_VERIFY, false)

  // Verify SMTP connection before sending
  if (shouldVerify) {
    await transporter.verify()
    console.log('[emailService] SMTP connection verified.')
  }

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
  let info
  try {
    info = await transporter.sendMail(mailOptions)
  } catch (error) {
    // Retry once without prior verify path; transient SMTP network errors are common on cloud hosts.
    console.warn(`[emailService] First send attempt failed: ${error.code || error.message}. Retrying once...`)
    info = await transporter.sendMail(mailOptions)
  }

  console.log(`[emailService] Email sent! Message ID: ${info.messageId}`)
  return info
}

module.exports = { sendPOEmail }
