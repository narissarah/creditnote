import { json, type ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = await request.json();
    const { extension, level, message, data } = body;

    // Log with a special prefix so it's easy to find in Vercel logs
    const logPrefix = `[POS-${extension?.toUpperCase() || 'UNKNOWN'}]`;
    const timestamp = new Date().toISOString();

    const logMessage = `${logPrefix} ${timestamp} [${level || 'INFO'}] ${message}`;

    if (data) {
      console.log(logMessage, JSON.stringify(data, null, 2));
    } else {
      console.log(logMessage);
    }

    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[POS-LOGS] Error processing log:', error);
    return json({ success: false, error: 'Failed to process log' }, { status: 500 });
  }
}

// Handle OPTIONS for CORS preflight
export async function loader() {
  return json({ method: 'POST only' }, { status: 405 });
}
