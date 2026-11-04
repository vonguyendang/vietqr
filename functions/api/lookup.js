export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-client-id, x-api-key"
      }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ code: "405", desc: "Method Not Allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    const body = await request.json();
    const clientId = request.headers.get("x-client-id") || env.VIETQR_CLIENT_ID;
    const apiKey = request.headers.get("x-api-key") || env.VIETQR_API_KEY;

    if (!clientId || !apiKey) {
      return new Response(JSON.stringify({
        code: "401",
        desc: "Missing API Key & Client Key. Please provide x-client-id and x-api-key headers from https://my.vietqr.io or configure them in Cloudflare environment variables."
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const upstream = await fetch("https://api.vietqr.io/v2/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      code: "500",
      desc: err.message || "Internal Server Error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

