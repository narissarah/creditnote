import { type LoaderFunctionArgs } from "@remix-run/node";
import QRCode from "qrcode";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const qrData = url.searchParams.get("data");

  if (!qrData) {
    return new Response("Missing QR data", { status: 400 });
  }

  try {
    // Parse the QR payload
    let payload;
    try {
      payload = JSON.parse(qrData);
    } catch {
      return new Response("Invalid QR data format", { status: 400 });
    }

    // Generate QR code as data URL (200x200 optimized for receipt printers)
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'H' // High error correction for thermal printer reliability
    });

    // Create HTML optimized for receipt printers (280px width, monospace)
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Store Credit Receipt</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            width: 280px;
            margin: 0;
            padding: 8px;
            text-align: center;
            font-size: 12px;
            line-height: 1.4;
        }
        h1 {
            font-size: 16px;
            font-weight: bold;
            margin: 8px 0;
            text-transform: uppercase;
            border-bottom: 2px dashed #000;
            padding-bottom: 8px;
        }
        .qr-container {
            margin: 16px 0;
            text-align: center;
        }
        .qr-code {
            width: 200px;
            height: 200px;
            margin: 0 auto;
        }
        .info {
            text-align: left;
            margin: 16px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 8px 0;
        }
        .info-row {
            margin: 4px 0;
            font-size: 11px;
        }
        .label {
            font-weight: bold;
            text-transform: uppercase;
        }
        .value {
            margin-left: 4px;
        }
        .customer-id {
            font-size: 9px;
            word-wrap: break-word;
            margin-top: 4px;
        }
        .footer {
            margin-top: 12px;
            font-size: 10px;
            text-align: center;
            border-top: 2px dashed #000;
            padding-top: 8px;
        }
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <h1>*** STORE CREDIT ***</h1>

    <div class="qr-container">
        <img src="${qrCodeDataUrl}" alt="Store Credit QR Code" class="qr-code" />
    </div>

    <div class="info">
        <div class="info-row">
            <span class="label">CUSTOMER:</span>
            <span class="value">${payload.customerName || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="label">BALANCE:</span>
            <span class="value">$${payload.balance || payload.amount}</span>
        </div>
        <div class="info-row">
            <span class="label">CUSTOMER ID:</span>
            <div class="customer-id">${payload.customerId}</div>
        </div>
    </div>

    <div class="footer">
        SCAN QR CODE TO REDEEM
        AT CHECKOUT
    </div>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return new Response("Failed to generate QR code", { status: 500 });
  }
}
