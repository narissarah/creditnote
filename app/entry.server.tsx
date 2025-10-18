import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // Handle OPTIONS requests for CORS
  if (request.method === "OPTIONS") {
    const optionsHeaders = new Headers();
    optionsHeaders.set("Access-Control-Allow-Origin", "*");
    optionsHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    optionsHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Access-Token");
    optionsHeaders.set("Access-Control-Max-Age", "86400");

    return new Response(null, {
      status: 204,
      headers: optionsHeaders
    });
  }

  const userAgent = request.headers.get("user-agent") || '';
  const callbackName = isbot(userAgent) ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
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
        onShellError: reject,
        onError(error) {
          console.error('[ENTRY SERVER] Render error:', error);
          responseStatusCode = 500;
        },
      }
    );

    setTimeout(abort, streamTimeout);
  });
}
