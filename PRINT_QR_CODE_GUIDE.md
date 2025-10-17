# Print QR Code - Implementation Guide

## Overview

The "Print QR Code" button in the Create Store Credit extension now uses Shopify's Print API to generate and print QR codes for store credit redemption.

## How It Works

### 1. Create Store Credit
When you create store credit in the POS extension:
- Customer information is collected
- Store credit is created via Shopify API
- QR code payload is generated with all necessary data
- Success screen displays with "Print QR Code" button

### 2. Print QR Code Button
When the "Print QR Code" button is pressed (extensions/create/src/Modal.tsx:180-196):

```typescript
const handlePrintQR = async () => {
  if (!qrCodeData) {
    api.toast.show('No QR code data to print')
    return
  }

  try {
    // Use Print API to print QR code
    const encodedData = encodeURIComponent(qrCodeData)
    await api.print.print(`/api/print-qr?data=${encodedData}`)
    api.toast.show('Opening print dialog...')
  } catch (error) {
    console.error('Print error:', error)
    api.toast.show('Failed to print QR code')
  }
}
```

### 3. Backend Route
The backend route `/api/print-qr` (app/routes/api.print-qr.tsx) handles the QR generation:

**Process:**
1. Receives QR data via query parameter
2. Parses the JSON payload
3. Generates QR code image using `qrcode` library
4. Creates printable HTML document
5. Returns HTML to POS for printing

**QR Code Payload:**
```json
{
  "type": "store_credit",
  "customerId": "gid://shopify/Customer/...",
  "accountId": "gid://shopify/StoreCreditAccount/...",
  "amount": "55.00",
  "balance": "55.00",
  "currency": "USD",
  "customerName": "sara"
}
```

## Printed Document

The printed document includes:
- **Header:** "Store Credit"
- **QR Code:** 300x300px scannable QR code
- **Customer Information:**
  - Customer name
  - Balance amount and currency
  - Full customer ID
- **Footer:** "Scan this QR code to redeem store credit at checkout"

## Technical Details

### Print API Integration

**Extension Side:**
```typescript
await api.print.print(`/api/print-qr?data=${encodedData}`)
```

**How Print API Works:**
1. Takes relative path `/api/print-qr?data=...`
2. Appends to your `application_url` from shopify.app.toml
3. Full URL: `https://creditnote.vercel.app/api/print-qr?data=...`
4. Fetches HTML from backend
5. Opens native print dialog
6. User can print or save as PDF

### Backend Route

**File:** `app/routes/api.print-qr.tsx`

**Dependencies:**
- `qrcode` package (already in package.json)
- Generates QR code as data URL
- Returns HTML with embedded QR image

**Response Format:**
- Content-Type: `text/html; charset=utf-8`
- Printable HTML page with QR code and customer info

## Usage Flow

### For Staff:

1. Open POS → CreditNote app
2. Tap "Create Store Credit" tile
3. Search for customer
4. Enter store credit amount
5. Tap "Create Store Credit"
6. **Success screen appears**
7. **Tap "Print QR Code" button**
8. Native print dialog opens
9. Select printer or save as PDF
10. Print/Save the QR code

### For Customer:

1. Receive printed QR code
2. Bring to store for redemption
3. Staff scans QR code with Redeem extension
4. Store credit is applied

## Redemption

The printed QR code can be scanned using the **Redeem Store Credit** extension:

1. Staff opens Redeem extension
2. Taps "Scan QR Code / Barcode"
3. Camera opens (CameraScanner)
4. Scans customer's printed QR code
5. System automatically:
   - Extracts customer ID from QR payload
   - Fetches customer balance
   - Displays balance for redemption
6. Staff enters redemption amount
7. Processes redemption

## Supported Print Formats

According to Shopify Print API documentation:
- ✅ **HTML documents** (recommended - what we're using)
- ✅ Text files
- ✅ Image files (PNG, JPEG, etc.)
- ✅ PDF files
- ⚠️ **Note:** On Android devices, PDFs will be downloaded and must be printed using an external application

## Testing

### Local Testing:
1. Start dev server: `npm run dev`
2. Test in POS simulator or device
3. Create store credit
4. Click "Print QR Code"
5. Verify print dialog opens
6. Check printed output

### Production Testing:
1. Deploy: `npx shopify app deploy`
2. Test on actual POS device
3. Print QR code to physical printer
4. Scan with Redeem extension
5. Verify redemption works

## Troubleshooting

### Print Button Does Nothing:
- Check browser console for errors
- Verify Print API is available (`api.print`)
- Ensure application_url is correct in shopify.app.toml

### QR Code Not Generating:
- Check backend route is deployed
- Verify qrCodeData is populated
- Check server logs for errors
- Ensure `qrcode` package is installed

### Print Dialog Doesn't Open:
- Verify URL is correct
- Check CORS settings if using external URL
- Ensure backend returns valid HTML
- Check POS device has printing permissions

### Can't Scan Printed QR Code:
- Ensure QR code is high quality (errorCorrectionLevel: 'H')
- Check printer resolution
- Verify QR payload is valid JSON
- Test scanning with phone camera first

## Files Modified/Created

### New Files:
- `app/routes/api.print-qr.tsx` - Backend route for QR generation

### Modified Files:
- `extensions/create/src/Modal.tsx:180-196` - Print button handler

## Configuration

### Application URL (shopify.app.toml):
```toml
application_url = "https://creditnote.vercel.app"
```

This URL is used by Print API to construct full path:
- Relative: `/api/print-qr?data=...`
- Full: `https://creditnote.vercel.app/api/print-qr?data=...`

## QR Code Specifications

- **Size:** 300x300 pixels
- **Margin:** 2 units
- **Error Correction:** High (H level)
- **Format:** Data URL (embedded in HTML)
- **Encoding:** JSON string

## Security Considerations

1. **Data Exposure:**
   - QR codes contain customer ID and balance
   - Printed QR codes should be treated as sensitive
   - Consider adding expiration timestamps

2. **Validation:**
   - Backend validates QR payload format
   - Returns 400 error for invalid data
   - Logs errors for debugging

3. **Access Control:**
   - Print route is public (no auth required)
   - Only contains data already in QR payload
   - No database queries or modifications

## Future Enhancements

1. **QR Expiration:**
   - Add timestamp to QR payload
   - Validate expiration on redemption
   - Reject expired QR codes

2. **Security Tokens:**
   - Generate unique token per QR code
   - Store in database
   - Validate token on redemption

3. **Print Preview:**
   - Show preview before printing
   - Allow customization of print layout
   - Add store branding/logo

4. **Print History:**
   - Log all printed QR codes
   - Track which QR codes were redeemed
   - Analytics on QR code usage

## API Version

- **POS UI Extensions:** 2025-07
- **Print API:** Latest stable
- **QRCode Package:** v1.5.4

---

## Quick Reference

**Print QR Code:**
```typescript
await api.print.print(`/api/print-qr?data=${encodeURIComponent(qrCodeData)}`)
```

**Backend Route:**
```
GET /api/print-qr?data=<encoded-json>
```

**Response:**
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Store Credit</h1>
    <img src="data:image/png;base64,..." />
    <!-- Customer info -->
  </body>
</html>
```

---

**Build Status:** ✅ All extensions built successfully

**Deployment:** Ready to deploy with `npx shopify app deploy`
