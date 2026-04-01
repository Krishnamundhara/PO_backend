// server.js
// Entry point for the PO Email Backend Service
// Starts an Express server that listens for PO events and sends emails with PDF attachments

require('dotenv').config() // Load environment variables from .env file FIRST

const express = require('express')
const cors = require('cors')
const poRoutes = require('./routes/poRoutes')

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = express()
const PORT = process.env.PORT || 5000

// ── Middleware ────────────────────────────────────────────────────────────────

// Allow cross-origin requests (needed when calling from Supabase webhooks or frontend)
app.use(cors())

// Parse incoming JSON bodies (required for POST requests)
app.use(express.json())

// Log every incoming request (helpful for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — useful to verify deployment is live
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// PO event routes (POST /po-event)
app.use('/', poRoutes)

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.message)
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message })
})

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ PO Email Backend running on port ${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   PO event:     POST http://localhost:${PORT}/po-event`)
})
