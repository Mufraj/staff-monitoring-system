// api/location.js

const { supabaseRequest } = require("./_supabase");

const OFFLINE_AFTER_SECONDS = 120;

function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getStatus(updatedAt) {
  if (!updatedAt) return "offline";

  const lastSeen = new Date(updatedAt);
  const diffSeconds = Math.floor((Date.now() - lastSeen.getTime()) / 1000);

  return diffSeconds <= OFFLINE_AFTER_SECONDS ? "online" : "offline";
}

function mapLocationRow(row) {
  return {
    staffId: row.staff_id,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    hdop: row.hdop,
    fixQuality: row.fix_quality,
    satellites: row.satellites,
    source: row.source,
    gga: row.gga,
    timestamp: row.device_time,
    serverTime: row.server_time,
    lastSeen: row.updated_at,
    status: getStatus(row.updated_at),
  };
}

function buildResponse(rows) {
  const staff = rows.map(mapLocationRow);

  const onlineCount = staff.filter((item) => item.status === "online").length;
  const offlineCount = staff.filter((item) => item.status === "offline").length;

  return {
    success: true,
    count: staff.length,
    onlineCount,
    offlineCount,
    updatedAt: new Date().toISOString(),
    latest: staff[0] || null,
    staff,
  };
}

async function fetchLocations(staffId = null) {
  let path =
    "staff_locations?select=*&order=updated_at.desc";

  if (staffId) {
    path += `&staff_id=eq.${encodeURIComponent(staffId)}`;
  }

  return await supabaseRequest(path);
}

async function saveLocation(body) {
  const now = new Date().toISOString();

  const staffId = String(body.staffId || body.staff_id || "Staff-1");

  const latitude = toNumber(body.latitude ?? body.lat);
  const longitude = toNumber(body.longitude ?? body.lng ?? body.lon);

  if (latitude === null || longitude === null) {
    return {
      error: true,
      statusCode: 400,
      message: "latitude and longitude are required",
    };
  }

  const payload = {
    staff_id: staffId,
    latitude,
    longitude,
    altitude: toNumber(body.altitude),
    hdop: toNumber(body.hdop),
    fix_quality:
      body.fixQuality !== undefined && body.fixQuality !== null
        ? String(body.fixQuality)
        : null,
    satellites:
      body.satellites !== undefined && body.satellites !== null
        ? String(body.satellites)
        : null,
    source: body.source || "rtk_ble_receiver",
    gga: body.gga || null,
    device_time: body.timestamp || body.time || now,
    server_time: now,
    updated_at: now,
  };

  const savedRows = await supabaseRequest(
    "staff_locations?on_conflict=staff_id",
    {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: payload,
    }
  );

  return {
    saved: mapLocationRow(savedRows[0]),
  };
}

module.exports = async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const staffId = req.query.staffId || null;
      const rows = await fetchLocations(staffId);

      return res.status(200).json(buildResponse(rows));
    }

    if (req.method === "POST") {
      const result = await saveLocation(req.body || {});

      if (result.error) {
        return res.status(result.statusCode || 400).json({
          success: false,
          message: result.message,
        });
      }

      const rows = await fetchLocations();

      return res.status(200).json({
        message: "Location saved successfully",
        saved: result.saved,
        ...buildResponse(rows),
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};