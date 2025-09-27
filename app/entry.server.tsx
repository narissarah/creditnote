import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";
// CRITICAL FIX: Removed addDocumentResponseHeaders import to avoid ESM issues
// Manual headers are set below to replace this functionality

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  try {
    // CRITICAL FIX: Set essential headers manually to avoid ESM/CommonJS issues
    // Replaces problematic addDocumentResponseHeaders call
    responseHeaders.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "ALLOWALL");

    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? '')
      ? "onAllReady"
      : "onShellReady";

    return new Promise((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        <RemixServer
          context={remixContext}
          url={request.url}
        />,
        {
          [callbackName]: () => {
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            responseHeaders.set("Content-Type", "text/html");
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );
            pipe(body);
          },
          onShellError(error) {
            console.error('[ENTRY SERVER] Shell error:', error);
            reject(error);
          },
          onError(error) {
            console.error('[ENTRY SERVER] Render error:', error);
            responseStatusCode = 500;
          },
        }
      );

      // Reduce timeout to prevent serverless function timeout
      setTimeout(abort, 4000);
    });
  } catch (error) {
    console.error('[ENTRY SERVER] Critical error:', error);
    throw error;
  }
}
