// api/location.js

const OFFLINE_AFTER_SECONDS = 120;

// Store staff data in memory for demo/live prototype.
// Note: For production, use a real database like Firebase, Supabase, MongoDB, etc.
globalThis.staffLocations = globalThis.staffLocations || {};

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getStatus(lastSeen) {
  if (!lastSeen) return "offline";

  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffSeconds = diffMs / 1000;

  if (diffSeconds <= OFFLINE_AFTER_SECONDS) return "online";
  return "offline";
}

function normalizeStaffPayload(body) {
  const now = new Date().toISOString();

  const staffId =
    body.staffId ||
    body.staff_id ||
    body.receiverId ||
    body.receiver_id ||
    "Staff-1";

  const latitude = toNumber(body.latitude ?? body.lat);
  const longitude = toNumber(body.longitude ?? body.lng ?? body.lon);

  return {
    staffId: String(staffId),
    latitude,
    longitude,

    altitude: toNumber(body.altitude),
    hdop: toNumber(body.hdop),

    fixQuality:
      body.fixQuality !== undefined && body.fixQuality !== null
        ? String(body.fixQuality)
        : null,

    satellites:
      body.satellites !== undefined && body.satellites !== null
        ? String(body.satellites)
        : null,

    source: body.source || "rtk_ble_receiver",
    gga: body.gga || null,

    time: body.time || body.timestamp || now,
    timestamp: body.timestamp || body.time || now,

    lastSeen: now,
    serverTime: now,
  };
}

function buildStaffList() {
  return Object.values(globalThis.staffLocations)
    .map((staff) => ({
      ...staff,
      status: getStatus(staff.lastSeen),
    }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function buildResponse() {
  const staff = buildStaffList();

  const onlineCount = staff.filter((item) => item.status === "online").length;
  const offlineCount = staff.length - onlineCount;

  const latest = staff[0] || {
    staffId: null,
    latitude: null,
    longitude: null,
    altitude: null,
    hdop: null,
    fixQuality: null,
    satellites: null,
    source: null,
    gga: null,
    time: null,
    timestamp: null,
    lastSeen: null,
    serverTime: null,
    status: "offline",
  };

  return {
    // Backward compatible fields for old dashboard
    staffId: latest.staffId,
    latitude: latest.latitude,
    longitude: latest.longitude,
    time: latest.time,

    // New dashboard fields
    success: true,
    count: staff.length,
    onlineCount,
    offlineCount,
    updatedAt: new Date().toISOString(),
    latest,
    staff,
  };
}

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const staffId = req.query.staffId;

    if (staffId) {
      const staff = globalThis.staffLocations[staffId];

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff location not found",
          staffId,
        });
      }

      return res.status(200).json({
        success: true,
        ...staff,
        status: getStatus(staff.lastSeen),
      });
    }

    return res.status(200).json(buildResponse());
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const staffData = normalizeStaffPayload(body);

    if (staffData.latitude === null || staffData.longitude === null) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
        received: body,
      });
    }

    globalThis.staffLocations[staffData.staffId] = staffData;

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      saved: {
        ...staffData,
        status: getStatus(staffData.lastSeen),
      },
      ...buildResponse(),
    });
  }

  return res.status(405).json({
    success: false,
    message: "Method not allowed",
  });
};