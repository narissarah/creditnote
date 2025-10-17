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

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H'
    });

    // Create HTML for printing
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Store Credit QR Code</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        .qr-container {
            margin: 20px 0;
        }
        .qr-code {
            max-width: 300px;
            height: auto;
        }
        .info {
            text-align: left;
            margin-top: 20px;
            padding: 15px;
            background-color: #f5f5f5;
            border-radius: 8px;
        }
        .info-row {
            margin: 8px 0;
            font-size: 14px;
        }
        .label {
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
        }
        @media print {
            body {
                padding: 0;
            }
            .footer {
                page-break-before: avoid;
            }
        }
    </style>
</head>
<body>
    <h1>Store Credit</h1>

    <div class="qr-container">
        <img src="${qrCodeDataUrl}" alt="Store Credit QR Code" class="qr-code" />
    </div>

    <div class="info">
        <div class="info-row">
            <span class="label">Customer:</span> ${payload.customerName || 'N/A'}
        </div>
        <div class="info-row">
            <span class="label">Balance:</span> ${payload.balance || payload.amount} ${payload.currency || 'USD'}
        </div>
        <div class="info-row">
            <span class="label">Customer ID:</span><br/>
            <small>${payload.customerId}</small>
        </div>
    </div>

    <div class="footer">
        Scan this QR code to redeem store credit at checkout
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
