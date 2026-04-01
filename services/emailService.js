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

function createTransporterFromConfig({ host, port, secure }) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: parseNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 15000),
    greetingTimeout: parseNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: parseNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000)
  })
}

function buildSmtpCandidates() {
  const host = process.env.SMTP_HOST
  const configuredPort = parseNumber(process.env.SMTP_PORT, 587)
  const configuredSecure = parseBoolean(process.env.SMTP_SECURE, configuredPort === 465)

  const candidates = [{ host, port: configuredPort, secure: configuredSecure }]

  // Gmail deployments on cloud hosts may work on one mode and timeout on the other.
  if (host === 'smtp.gmail.com') {
    const gmailFallbacks = [
      { host, port: 587, secure: false },
      { host, port: 465, secure: true }
    ]

    for (const fallback of gmailFallbacks) {
      const exists = candidates.some(
        (candidate) => candidate.port === fallback.port && candidate.secure === fallback.secure
      )
      if (!exists) {
        candidates.push(fallback)
      }
    }
  }

  return candidates
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

  const shouldVerify = parseBoolean(process.env.SMTP_VERIFY, false)

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

  // Send the email by trying configured mode first, then Gmail fallback mode if needed.
  const candidates = buildSmtpCandidates()
  let lastError
  let info

  for (const candidate of candidates) {
    const transporter = createTransporterFromConfig(candidate)
    try {
      if (shouldVerify) {
        await transporter.verify()
        console.log(
          `[emailService] SMTP verified on ${candidate.host}:${candidate.port} secure=${candidate.secure}`
        )
      }

      info = await transporter.sendMail(mailOptions)
      console.log(
        `[emailService] Email sent via ${candidate.host}:${candidate.port} secure=${candidate.secure}`
      )
      break
    } catch (error) {
      lastError = error
      console.warn(
        `[emailService] Send failed on ${candidate.host}:${candidate.port} secure=${candidate.secure} with ${error.code || error.message}`
      )
    }
  }

  if (!info) {
    throw lastError || new Error('SMTP send failed for all transport candidates')
  }

  console.log(`[emailService] Email sent! Message ID: ${info.messageId}`)
  return info
}

module.exports = { sendPOEmail }
