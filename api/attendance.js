// api/attendance.js

const DEFAULT_SHIFT_START = "09:00";
const DEFAULT_SHIFT_END = "17:00";
const TIME_ZONE = "Asia/Karachi";

globalThis.attendanceRecords = globalThis.attendanceRecords || {};
globalThis.attendanceAlerts = globalThis.attendanceAlerts || [];

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

function getDateKey(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function getTimeParts(dateValue) {
  const date = new Date(dateValue);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const time = formatter.format(date);
  const [hour, minute] = time.split(":").map(Number);

  return { hour, minute, totalMinutes: hour * 60 + minute, time };
}

function shiftToMinutes(shiftTime) {
  const [hour, minute] = String(shiftTime || DEFAULT_SHIFT_START)
    .split(":")
    .map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 9 * 60;
  }

  return hour * 60 + minute;
}

function calculateLateStatus(timestamp, shiftStart) {
  const clockInTime = getTimeParts(timestamp);
  const shiftStartMinutes = shiftToMinutes(shiftStart);

  const lateMinutes = clockInTime.totalMinutes - shiftStartMinutes;

  return {
    isLate: lateMinutes > 0,
    lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
    clockInLocalTime: clockInTime.time,
  };
}

function createLateAlert(record) {
  const alertId = `ALERT-${Date.now()}`;

  const alert = {
    alertId,
    staffId: record.staffId,
    type: "late_arrival",
    severity: record.lateMinutes >= 15 ? "high" : "medium",
    message: `${record.staffId} arrived ${record.lateMinutes} minutes late.`,
    time: new Date().toISOString(),
    date: record.date,
    acknowledged: false,
  };

  globalThis.attendanceAlerts.unshift(alert);

  return alert;
}

function buildAttendanceList() {
  return Object.values(globalThis.attendanceRecords).sort(
    (a, b) => new Date(b.lastEventAt) - new Date(a.lastEventAt)
  );
}

function buildResponse() {
  const records = buildAttendanceList();

  const onDutyCount = records.filter((item) => item.status === "on_duty").length;
  const completedCount = records.filter(
    (item) => item.status === "completed"
  ).length;
  const lateCount = records.filter((item) => item.isLate).length;

  return {
    success: true,
    count: records.length,
    onDutyCount,
    completedCount,
    lateCount,
    updatedAt: new Date().toISOString(),
    records,
    alerts: globalThis.attendanceAlerts,
  };
}

function handleClockIn(body) {
  const now = new Date().toISOString();

  const staffId = String(body.staffId || body.staff_id || "Staff-1");
  const timestamp = body.timestamp || body.time || now;
  const date = body.date || getDateKey(timestamp);
  const shiftStart = body.shiftStart || DEFAULT_SHIFT_START;
  const shiftEnd = body.shiftEnd || DEFAULT_SHIFT_END;

  const recordKey = `${staffId}_${date}`;

  const lateStatus = calculateLateStatus(timestamp, shiftStart);

  const existingRecord = globalThis.attendanceRecords[recordKey];

  const record = {
    attendanceId: recordKey,
    staffId,
    date,
    shiftStart,
    shiftEnd,

    clockIn: timestamp,
    clockOut: existingRecord?.clockOut || null,

    clockInLocalTime: lateStatus.clockInLocalTime,
    clockOutLocalTime: existingRecord?.clockOutLocalTime || null,

    status: existingRecord?.clockOut ? "completed" : "on_duty",

    isLate: lateStatus.isLate,
    lateMinutes: lateStatus.lateMinutes,

    latitude: toNumber(body.latitude ?? body.lat),
    longitude: toNumber(body.longitude ?? body.lng ?? body.lon),

    source: body.source || "employee_app",
    note: body.note || null,

    lastEvent: "clock_in",
    lastEventAt: now,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
  };

  globalThis.attendanceRecords[recordKey] = record;

  let alert = null;

  const alreadyHasLateAlert = globalThis.attendanceAlerts.some(
    (item) =>
      item.staffId === staffId &&
      item.date === date &&
      item.type === "late_arrival"
  );

  if (record.isLate && !alreadyHasLateAlert) {
    alert = createLateAlert(record);
  }

  return {
    record,
    alert,
  };
}

function handleClockOut(body) {
  const now = new Date().toISOString();

  const staffId = String(body.staffId || body.staff_id || "Staff-1");
  const timestamp = body.timestamp || body.time || now;
  const date = body.date || getDateKey(timestamp);

  const recordKey = `${staffId}_${date}`;
  const existingRecord = globalThis.attendanceRecords[recordKey];

  if (!existingRecord) {
    return {
      error: true,
      statusCode: 404,
      message: "No clock-in record found for this staff today.",
    };
  }

  const clockOutTime = getTimeParts(timestamp);

  const updatedRecord = {
    ...existingRecord,
    clockOut: timestamp,
    clockOutLocalTime: clockOutTime.time,
    status: "completed",
    lastEvent: "clock_out",
    lastEventAt: now,
    updatedAt: now,

    latitude: toNumber(body.latitude ?? body.lat) ?? existingRecord.latitude,
    longitude:
      toNumber(body.longitude ?? body.lng ?? body.lon) ??
      existingRecord.longitude,
  };

  globalThis.attendanceRecords[recordKey] = updatedRecord;

  return {
    record: updatedRecord,
    alert: null,
  };
}

module.exports = function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const staffId = req.query.staffId;

    if (staffId) {
      const records = buildAttendanceList().filter(
        (item) => item.staffId === staffId
      );

      const alerts = globalThis.attendanceAlerts.filter(
        (item) => item.staffId === staffId
      );

      return res.status(200).json({
        success: true,
        staffId,
        count: records.length,
        records,
        alerts,
      });
    }

    return res.status(200).json(buildResponse());
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const event = body.event || body.type;

    if (!event) {
      return res.status(400).json({
        success: false,
        message: "event is required. Use clock_in or clock_out.",
      });
    }

    let result;

    if (event === "clock_in") {
      result = handleClockIn(body);
    } else if (event === "clock_out") {
      result = handleClockOut(body);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid event. Use clock_in or clock_out.",
      });
    }

    if (result.error) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${event} saved successfully`,
      saved: result.record,
      alert: result.alert,
      ...buildResponse(),
    });
  }

  return res.status(405).json({
    success: false,
    message: "Method not allowed",
  });
};