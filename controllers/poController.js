// controllers/poController.js
// Orchestrates the full PO event flow:
//   1. Parse request body
//   2. Generate PDF buffer
//   3. Send email with PDF attached
//   4. Return success/error response

const { generatePDFBuffer } = require('../services/pdfService')
const { sendPOEmail } = require('../services/emailService')

/**
 * POST /po-event
 * Body: { poNumber, partyName, poData }
 */
async function handlePOEvent(req, res) {
  console.log('[poController] Received PO event:', new Date().toISOString())

  // ── Step 1: Extract fields from request body ──────────────────────────────
  const { poNumber, partyName, poData, eventType } = req.body

  // Basic validation — these three fields are required
  if (!poNumber || !partyName || !poData) {
    console.warn('[poController] Missing required fields in request body')
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: poNumber, partyName, poData'
    })
  }

  try {
    // ── Step 2: Generate PDF ────────────────────────────────────────────────
    console.log(`[poController] Generating PDF for PO: ${poNumber}`)
    const pdfBuffer = await generatePDFBuffer(poData)

    // ── Step 3: Send Email ──────────────────────────────────────────────────
    console.log(`[poController] Sending email for PO: ${poNumber} to ${process.env.RECEIVER_EMAIL}`)
    await sendPOEmail({
      poNumber,
      partyName,
      eventType: eventType || 'created', // "created" or "updated"
      pdfBuffer
    })

    // ── Step 4: Return success response ────────────────────────────────────
    console.log(`[poController] ✅ PO event processed successfully for: ${poNumber}`)
    return res.status(200).json({
      success: true,
      message: `Email sent for PO ${poNumber}`
    })

  } catch (error) {
    // Catch any error from PDF generation or email sending
    console.error('[poController] ❌ Error processing PO event:', {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode
    })
    if (error.stack) {
      console.error(error.stack)
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    })
  }
}

module.exports = { handlePOEvent }
