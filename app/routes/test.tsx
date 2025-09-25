export async function loader() {
  return new Response('{"status":"ok","test":"minimal endpoint"}', {
    headers: { 'Content-Type': 'application/json' }
  });
}