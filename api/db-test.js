// api/db-test.js

module.exports.config = {
  runtime: "nodejs",
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const rawUrl = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const cleanUrl = rawUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanUrl}/rest/v1/staff_locations?select=%2A&limit=1`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();

    let data = null;

    if (text) {
      data = JSON.parse(text);
    }

    return res.status(response.status).json({
      success: response.ok,
      message: response.ok
        ? "Supabase connection working"
        : "Supabase responded with an error",
      debug: {
        hasSupabaseUrl: Boolean(rawUrl),
        supabaseUrlPreview: cleanUrl,
        targetUrl,
        hasServiceKey: Boolean(serviceKey),
        serviceKeyLength: serviceKey.length,
        status: response.status,
      },
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      errorName: error.name,
      errorCause: error.cause?.message || null,
      debug: {
        hasSupabaseUrl: Boolean(rawUrl),
        supabaseUrlPreview: cleanUrl,
        targetUrl,
        hasServiceKey: Boolean(serviceKey),
        serviceKeyLength: serviceKey.length,
      },
    });
  }
};