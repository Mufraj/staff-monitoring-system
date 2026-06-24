// api/attendance.js

const { supabaseRequest } = require("./_supabase");

const DEFAULT_SHIFT_START = "09:00";
const DEFAULT_SHIFT_END = "17:00";
const TIME_ZONE = "Asia/Karachi";

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

  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
    time,
  };
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

function mapAttendanceRow(row) {
  return {
    attendanceId: row.attendance_id,
    staffId: row.staff_id,
    date: row.date,
    shiftStart: row.shift_start,
    shiftEnd: row.shift_end,

    clockIn: row.clock_in,
    clockOut: row.clock_out,

    clockInLocalTime: row.clock_in_local_time,
    clockOutLocalTime: row.clock_out_local_time,

    status: row.status,

    isLate: row.is_late,
    lateMinutes: row.late_minutes,

    latitude: row.latitude,
    longitude: row.longitude,

    source: row.source,
    note: row.note,

    lastEvent: row.last_event,
    lastEventAt: row.last_event_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAlertRow(row) {
  return {
    alertId: row.alert_id,
    staffId: row.staff_id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    date: row.date,
    acknowledged: row.acknowledged,
    time: row.created_at,
  };
}

function buildResponse(recordRows, alertRows) {
  const records = recordRows.map(mapAttendanceRow);
  const alerts = alertRows.map(mapAlertRow);

  const onDutyCount = records.filter(
    (item) => item.status === "on_duty"
  ).length;

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
    alerts,
  };
}

async function fetchAttendanceData(staffId = null) {
  let recordsPath =
    "attendance_records?select=*&order=last_event_at.desc";

  let alertsPath =
    "attendance_alerts?select=*&order=created_at.desc";

  if (staffId) {
    recordsPath += `&staff_id=eq.${encodeURIComponent(staffId)}`;
    alertsPath += `&staff_id=eq.${encodeURIComponent(staffId)}`;
  }

  const records = await supabaseRequest(recordsPath);
  const alerts = await supabaseRequest(alertsPath);

  return {
    records,
    alerts,
  };
}

async function lateAlertExists(staffId, date) {
  const rows = await supabaseRequest(
    `attendance_alerts?select=*&staff_id=eq.${encodeURIComponent(
      staffId
    )}&date=eq.${encodeURIComponent(date)}&type=eq.late_arrival&limit=1`
  );

  return rows.length > 0;
}

async function createLateAlert(record) {
  const alertId = `ALERT-${Date.now()}-${record.staff_id}`;

  const alertPayload = {
    alert_id: alertId,
    staff_id: record.staff_id,
    type: "late_arrival",
    severity: record.late_minutes >= 15 ? "high" : "medium",
    message: `${record.staff_id} arrived ${record.late_minutes} minutes late.`,
    date: record.date,
    acknowledged: false,
    created_at: new Date().toISOString(),
  };

  const rows = await supabaseRequest("attendance_alerts", {
    method: "POST",
    prefer: "return=representation",
    body: alertPayload,
  });

  return rows[0];
}

async function getExistingAttendance(attendanceId) {
  const rows = await supabaseRequest(
    `attendance_records?select=*&attendance_id=eq.${encodeURIComponent(
      attendanceId
    )}&limit=1`
  );

  return rows[0] || null;
}

async function handleClockIn(body) {
  const now = new Date().toISOString();

  const staffId = String(body.staffId || body.staff_id || "Staff-1");
  const timestamp = body.timestamp || body.time || now;
  const date = body.date || getDateKey(timestamp);
  const shiftStart = body.shiftStart || DEFAULT_SHIFT_START;
  const shiftEnd = body.shiftEnd || DEFAULT_SHIFT_END;

  const attendanceId = `${staffId}_${date}`;

  const existingRecord = await getExistingAttendance(attendanceId);
  const lateStatus = calculateLateStatus(timestamp, shiftStart);

  const payload = {
    attendance_id: attendanceId,
    staff_id: staffId,
    date,
    shift_start: shiftStart,
    shift_end: shiftEnd,

    clock_in: timestamp,
    clock_out: existingRecord?.clock_out || null,

    clock_in_local_time: lateStatus.clockInLocalTime,
    clock_out_local_time: existingRecord?.clock_out_local_time || null,

    status: existingRecord?.clock_out ? "completed" : "on_duty",

    is_late: lateStatus.isLate,
    late_minutes: lateStatus.lateMinutes,

    latitude: toNumber(body.latitude ?? body.lat),
    longitude: toNumber(body.longitude ?? body.lng ?? body.lon),

    source: body.source || "employee_app",
    note: body.note || null,

    last_event: "clock_in",
    last_event_at: now,
    created_at: existingRecord?.created_at || now,
    updated_at: now,
  };

  const rows = await supabaseRequest(
    "attendance_records?on_conflict=attendance_id",
    {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: payload,
    }
  );

  const savedRecord = rows[0];

  let alert = null;

  if (savedRecord.is_late) {
    const alreadyExists = await lateAlertExists(staffId, date);

    if (!alreadyExists) {
      alert = await createLateAlert(savedRecord);
    }
  }

  return {
    record: savedRecord,
    alert,
  };
}

async function handleClockOut(body) {
  const now = new Date().toISOString();

  const staffId = String(body.staffId || body.staff_id || "Staff-1");
  const timestamp = body.timestamp || body.time || now;
  const date = body.date || getDateKey(timestamp);

  const attendanceId = `${staffId}_${date}`;
  const existingRecord = await getExistingAttendance(attendanceId);

  if (!existingRecord) {
    return {
      error: true,
      statusCode: 404,
      message: "No clock-in record found for this staff today.",
    };
  }

  const clockOutTime = getTimeParts(timestamp);

  const latitude =
    toNumber(body.latitude ?? body.lat) ?? existingRecord.latitude;

  const longitude =
    toNumber(body.longitude ?? body.lng ?? body.lon) ??
    existingRecord.longitude;

  const payload = {
    clock_out: timestamp,
    clock_out_local_time: clockOutTime.time,
    status: "completed",
    last_event: "clock_out",
    last_event_at: now,
    updated_at: now,
    latitude,
    longitude,
  };

  const rows = await supabaseRequest(
    `attendance_records?attendance_id=eq.${encodeURIComponent(attendanceId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: payload,
    }
  );

  return {
    record: rows[0],
    alert: null,
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
      const { records, alerts } = await fetchAttendanceData(staffId);

      if (staffId) {
        return res.status(200).json({
          success: true,
          staffId,
          count: records.length,
          records: records.map(mapAttendanceRow),
          alerts: alerts.map(mapAlertRow),
        });
      }

      return res.status(200).json(buildResponse(records, alerts));
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
        result = await handleClockIn(body);
      } else if (event === "clock_out") {
        result = await handleClockOut(body);
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

      const { records, alerts } = await fetchAttendanceData();

      return res.status(200).json({
        success: true,
        message: `${event} saved successfully`,
        saved: mapAttendanceRow(result.record),
        alert: result.alert ? mapAlertRow(result.alert) : null,
        ...buildResponse(records, alerts),
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