// Handle favicon.ico requests from Vercel bots
export const loader = () => {
  // Return empty 204 No Content to prevent 404 errors
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
};
