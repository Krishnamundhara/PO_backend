// routes/poRoutes.js
// Defines the POST /po-event route and maps it to the controller

const express = require('express')
const router = express.Router()
const { handlePOEvent } = require('../controllers/poController')

/**
 * POST /po-event
 *
 * Expected body:
 * {
 *   "poNumber":  "PO123",
 *   "partyName": "ABC Traders",
 *   "eventType": "created" | "updated"   (optional, defaults to "created")
 *   "poData":    { ...full PO fields... }
 * }
 */
router.post('/po-event', handlePOEvent)

module.exports = router
