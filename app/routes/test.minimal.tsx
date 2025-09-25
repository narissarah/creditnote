// Ultra-minimal endpoint - no imports, no dependencies
export async function loader() {
  try {
    return new Response(JSON.stringify({
      status: "ok",
      message: "Ultra minimal - no dependencies",
      timestamp: Date.now()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: "minimal failure"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}