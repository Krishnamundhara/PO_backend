// services/pdfService.js
// Generates a PDF from Purchase Order data using Puppeteer
// HTML template matches the frontend src/services/pdfService.js exactly

const puppeteer = require('puppeteer')

/**
 * Formats a date string to DD MMM YYYY (e.g. "29 Mar 2026")
 * Mirrors the frontend formatDate utility
 */
function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

/**
 * Builds the PO HTML — matches the frontend createPDFContent() template exactly.
 * @param {Object} po             - PO fields (po_number, date, party_name, etc.)
 * @param {Object} companyDetails - Company info from Settings (name, address, logo, bank_*)
 */
function buildPOHtml(po, companyDetails = {}) {
  return `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 1px;">
        <h1 style="font-size: 18px; margin: 0; font-family: serif;">|| श्री:गणेशाय नमः ||</h1>
      </div>

      <!-- Company Details -->
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 1px; gap: 15px;">
        ${companyDetails.logo ? `<div><img src="${companyDetails.logo}" style="max-width: 100px; max-height: 100px; object-fit: contain;" /></div>` : ''}
        <div style="text-align: left;">
          <h2 style="font-size: 18px; margin: 5px 0; font-weight: bold;">${companyDetails.name || 'Company Name'}</h2>
          <p style="font-size: 12px; margin: 5px 0; line-height: 1.4;">${companyDetails.address || ''}</p>
        </div>
      </div>

      <!-- Order Number and Date -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; font-weight: bold;">
        <div>Order number: ${po.po_number || ''}</div>
        <div>Date: ${formatDate(po.date)}</div>
      </div>

      <!-- Order Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 5px 0; margin-bottom: 1px; border: 1px solid #000;">
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold; width: 40%;">PARTY NAME:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.party_name || ''}</td>
        </tr>
        ${po.broker ? `
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold;">BROKER:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.broker}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold;">MILL:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.mill || ''}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold;">QUALITY:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.product || ''}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold;">RATE:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.rate || ''}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold;">WEIGHT:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.weight || ''} ${po.weight_unit || ''}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #000; font-weight: bold;">BAGS:</td>
          <td style="padding: 8px 12px; border: 1px solid #000;">${po.quantity || ''}</td>
        </tr>
      </table>

      <!-- Terms & Conditions -->
      ${po.terms_conditions ? `<div style="margin-bottom: 5px;"><strong>Terms &amp; Conditions:</strong><p style="margin-top: 5px; margin-bottom: 5px;">${po.terms_conditions}</p></div>` : ''}

      <!-- Bank Details Footer -->
      ${companyDetails.bank_name ? `
      <div style="margin-top: 5px; font-size: 12px; font-weight: bold;">
        <span>BANK DETAILS</span><br/>
        <span>${companyDetails.bank_name}${companyDetails.account_number ? ` , ACCOUNT NO ${companyDetails.account_number}` : ''}${companyDetails.ifsc_code ? ` , IFSC: ${companyDetails.ifsc_code}` : ''}${companyDetails.branch ? ` , BRANCH: ${companyDetails.branch}` : ''}</span>
      </div>` : ''}
    </div>
  `
}

/**
 * Generates a PDF buffer from the given PO data using Puppeteer.
 * @param {Object} poData  - Full PO data including a `company` key for company details
 * @returns {Buffer}       - Binary PDF buffer ready for email attachment
 */
async function generatePDFBuffer(poData) {
  // Split company out of poData (it's merged in by the frontend emailBackend.js)
  const { companyDetails = {}, ...po } = poData

  let browser = null
  try {
    console.log('[pdfService] Launching Puppeteer browser...')

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',           // Required on Railway (Linux containers)
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    })

    const page = await browser.newPage()
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body>${buildPOHtml(po, companyDetails)}</body></html>`

    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    })

    console.log('[pdfService] PDF generated successfully, size:', pdfBuffer.length, 'bytes')
    return pdfBuffer

  } catch (error) {
    console.error('[pdfService] Error generating PDF:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
      console.log('[pdfService] Browser closed.')
    }
  }
}

module.exports = { generatePDFBuffer }
