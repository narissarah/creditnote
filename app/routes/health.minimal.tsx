// ULTRA-MINIMAL health check specifically for Vercel bots
// This route avoids ALL potential "require is not defined" issues
export const loader = () => {
  return new Response("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
};