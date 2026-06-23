import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "https://staff-monitoring-system.vercel.app/api/location";
const ATTENDANCE_API_URL =
  "https://staff-monitoring-system.vercel.app/api/attendance";
const TASKS_API_URL = "https://staff-monitoring-system.vercel.app/api/tasks";

function formatValue(value, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function formatNumber(value, digits = 6) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "--";
  return numberValue.toFixed(digits);
}

function formatDateTime(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

function secondsAgo(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSeconds < 5) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function getFixLabel(fixQuality) {
  const value = String(fixQuality ?? "");

  const labels = {
    "0": "Invalid",
    "1": "GPS Fix",
    "2": "DGPS Fix",
    "4": "RTK Fixed",
    "5": "RTK Float",
  };

  return labels[value] || formatValue(fixQuality);
}

function getStatusClass(status) {
  if (status === "online") return "status-online";
  if (status === "offline") return "status-offline";
  return "status-waiting";
}

function getAttendanceStatusLabel(status) {
  if (status === "on_duty") return "On Duty";
  if (status === "completed") return "Completed";
  return formatValue(status);
}

function getAttendanceStatusClass(status) {
  if (status === "on_duty") return "status-online";
  if (status === "completed") return "status-waiting";
  return "status-offline";
}

function getSeverityClass(severity) {
  if (severity === "high") return "status-offline";
  if (severity === "medium") return "status-waiting";
  return "status-online";
}

function getTaskStatusLabel(status) {
  if (status === "pending") return "Pending";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return formatValue(status);
}

function getTaskStatusClass(status) {
  if (status === "completed") return "status-online";
  if (status === "in_progress") return "status-waiting";
  if (status === "cancelled") return "status-offline";
  return "status-waiting";
}

function getPriorityClass(priority) {
  if (priority === "high") return "status-offline";
  if (priority === "medium") return "status-waiting";
  return "status-online";
}

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [tasksData, setTasksData] = useState(null);

  const [selectedStaffId, setSelectedStaffId] = useState("all");
  const [refreshInterval, setRefreshInterval] = useState(5);

  const [showSettings, setShowSettings] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [showRawGga, setShowRawGga] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchLocation = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Location API failed with status ${response.status}`);
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch location data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await fetch(ATTENDANCE_API_URL);
      if (!response.ok) {
        throw new Error(`Attendance API failed with status ${response.status}`);
      }

      const data = await response.json();
      setAttendanceData(data);
    } catch (error) {
      console.error("Attendance fetch error:", error);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(TASKS_API_URL);
      if (!response.ok) {
        throw new Error(`Tasks API failed with status ${response.status}`);
      }

      const data = await response.json();
      setTasksData(data);
    } catch (error) {
      console.error("Tasks fetch error:", error);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchLocation();
    fetchAttendance();
    fetchTasks();
  }, [fetchLocation, fetchAttendance, fetchTasks]);

  useEffect(() => {
    refreshAll();

    const timer = setInterval(refreshAll, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [refreshAll, refreshInterval]);

  const staffList = useMemo(() => {
    return dashboardData?.staff || [];
  }, [dashboardData]);

  const attendanceRecords = useMemo(() => {
    return attendanceData?.records || [];
  }, [attendanceData]);

  const attendanceAlerts = useMemo(() => {
    return attendanceData?.alerts || [];
  }, [attendanceData]);

  const taskList = useMemo(() => {
    return tasksData?.tasks || [];
  }, [tasksData]);

  const staffOptions = useMemo(() => {
    const ids = new Set();

    staffList.forEach((staff) => {
      if (staff.staffId) ids.add(staff.staffId);
    });

    attendanceRecords.forEach((record) => {
      if (record.staffId) ids.add(record.staffId);
    });

    taskList.forEach((task) => {
      if (task.staffId) ids.add(task.staffId);
    });

    return Array.from(ids).sort();
  }, [staffList, attendanceRecords, taskList]);

  const selectedStaff = useMemo(() => {
    if (selectedStaffId === "all") {
      return dashboardData?.latest || staffList[0] || null;
    }

    return (
      staffList.find((staff) => staff.staffId === selectedStaffId) || {
        staffId: selectedStaffId,
        status: "offline",
      }
    );
  }, [dashboardData, selectedStaffId, staffList]);

  const selectedAttendance = useMemo(() => {
    if (selectedStaffId === "all") {
      return attendanceRecords[0] || null;
    }

    return (
      attendanceRecords.find((record) => record.staffId === selectedStaffId) ||
      null
    );
  }, [attendanceRecords, selectedStaffId]);

  const selectedStaffTasks = useMemo(() => {
    if (selectedStaffId === "all") {
      return taskList;
    }

    return taskList.filter((task) => task.staffId === selectedStaffId);
  }, [taskList, selectedStaffId]);

  const onlineCount = dashboardData?.onlineCount || 0;
  const offlineCount = dashboardData?.offlineCount || 0;
  const totalStaff = Math.max(
    dashboardData?.count || 0,
    staffOptions.length || 0
  );

  const onDutyCount = attendanceData?.onDutyCount || 0;
  const completedCount = attendanceData?.completedCount || 0;
  const lateCount = attendanceData?.lateCount || 0;
  const alertCount = attendanceAlerts.length || 0;

  const pendingTaskCount = tasksData?.pendingCount || 0;
  const inProgressTaskCount = tasksData?.inProgressCount || 0;
  const completedTaskCount = tasksData?.completedCount || 0;
  const highPriorityTaskCount = tasksData?.highPriorityCount || 0;

  const topStatus =
    selectedStaffId === "all"
      ? onlineCount > 0
        ? "online"
        : "offline"
      : selectedStaff?.status || "offline";

  const hasLocation =
    selectedStaff?.latitude !== null &&
    selectedStaff?.latitude !== undefined &&
    selectedStaff?.longitude !== null &&
    selectedStaff?.longitude !== undefined;

  const coordinatesText = hasLocation
    ? `${selectedStaff.latitude}, ${selectedStaff.longitude}`
    : "";

  const openGoogleMaps = () => {
    if (!hasLocation) return;

    const url = `https://www.google.com/maps?q=${selectedStaff.latitude},${selectedStaff.longitude}`;
    window.open(url, "_blank");
  };

  const copyCoordinates = async () => {
    if (!hasLocation) return;

    try {
      await navigator.clipboard.writeText(coordinatesText);
      alert("Coordinates copied successfully");
    } catch {
      alert(coordinatesText);
    }
  };

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">RTK</div>
          <div>
            <h2>Supervisor</h2>
            <p>Admin Panel</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Staff Tracking</button>
          <button className="nav-item">Attendance</button>
          <button className="nav-item">Tasks</button>
          <button className="nav-item">Alerts</button>
          <button className="nav-item">Reports</button>
        </nav>

        <div className="sidebar-footer">
          <span>API</span>
          <strong>Connected</strong>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Live Staff Monitoring</p>
            <h1>Staff Monitoring System</h1>
            <p className="subtitle">
              Supervisor dashboard for RTK BLE receiver location, attendance,
              tasks, and late alerts
            </p>
          </div>

          <div className="topbar-actions">
            <span className={`status-pill ${getStatusClass(topStatus)}`}>
              {topStatus === "online" ? "Live" : "Offline"}
            </span>

            <button className="icon-button" onClick={refreshAll}>
              {loading ? "Syncing..." : "Refresh"}
            </button>

            <button
              className="settings-button"
              onClick={() => setShowSettings((value) => !value)}
            >
              ⚙
            </button>
          </div>
        </header>

        {showSettings && (
          <section className="settings-panel">
            <div>
              <label>View Staff</label>
              <select
                value={selectedStaffId}
                onChange={(event) => setSelectedStaffId(event.target.value)}
              >
                <option value="all">All Staff / Latest Active</option>

                {staffOptions.map((staffId) => (
                  <option key={staffId} value={staffId}>
                    {staffId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Refresh Interval</label>
              <select
                value={refreshInterval}
                onChange={(event) =>
                  setRefreshInterval(Number(event.target.value))
                }
              >
                <option value={3}>Every 3 seconds</option>
                <option value={5}>Every 5 seconds</option>
                <option value={10}>Every 10 seconds</option>
              </select>
            </div>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={showRawGga}
                onChange={(event) => setShowRawGga(event.target.checked)}
              />
              Show Raw GGA
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={showRawData}
                onChange={(event) => setShowRawData(event.target.checked)}
              />
              Show Raw API JSON
            </label>
          </section>
        )}

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        <section className="stats-grid">
          <div className="stat-card">
            <p>Total Staff</p>
            <h2>{totalStaff}</h2>
            <span>Registered in live feed</span>
          </div>

          <div className="stat-card success">
            <p>Online</p>
            <h2>{onlineCount}</h2>
            <span>Recently updated</span>
          </div>

          <div className="stat-card danger">
            <p>Offline</p>
            <h2>{offlineCount}</h2>
            <span>No recent update</span>
          </div>

          <div className="stat-card">
            <p>Current View</p>
            <h2>{selectedStaffId === "all" ? "All" : selectedStaffId}</h2>
            <span>Supervisor filter</span>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card success">
            <p>On Duty</p>
            <h2>{onDutyCount}</h2>
            <span>Currently clocked in</span>
          </div>

          <div className="stat-card">
            <p>Completed</p>
            <h2>{completedCount}</h2>
            <span>Clock-in and clock-out done</span>
          </div>

          <div className="stat-card danger">
            <p>Late Staff</p>
            <h2>{lateCount}</h2>
            <span>Late arrival detected</span>
          </div>

          <div className="stat-card danger">
            <p>Alerts</p>
            <h2>{alertCount}</h2>
            <span>Supervisor attention required</span>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <p>Pending Tasks</p>
            <h2>{pendingTaskCount}</h2>
            <span>Waiting to be started</span>
          </div>

          <div className="stat-card success">
            <p>In Progress</p>
            <h2>{inProgressTaskCount}</h2>
            <span>Currently being handled</span>
          </div>

          <div className="stat-card">
            <p>Completed Tasks</p>
            <h2>{completedTaskCount}</h2>
            <span>Finished by employees</span>
          </div>

          <div className="stat-card danger">
            <p>High Priority</p>
            <h2>{highPriorityTaskCount}</h2>
            <span>Needs supervisor attention</span>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel location-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Live Location</p>
                <h2>{formatValue(selectedStaff?.staffId, "No Staff Data")}</h2>
              </div>

              <span
                className={`status-pill ${getStatusClass(
                  selectedStaff?.status || "offline"
                )}`}
              >
                {formatValue(selectedStaff?.status, "offline")}
              </span>
            </div>

            <div className="location-grid">
              <div className="metric-box">
                <span>Latitude</span>
                <strong>{formatNumber(selectedStaff?.latitude, 7)}</strong>
              </div>

              <div className="metric-box">
                <span>Longitude</span>
                <strong>{formatNumber(selectedStaff?.longitude, 7)}</strong>
              </div>

              <div className="metric-box">
                <span>Altitude</span>
                <strong>
                  {selectedStaff?.altitude !== null &&
                  selectedStaff?.altitude !== undefined
                    ? `${formatNumber(selectedStaff.altitude, 2)} m`
                    : "--"}
                </strong>
              </div>

              <div className="metric-box">
                <span>HDOP</span>
                <strong>{formatNumber(selectedStaff?.hdop, 2)}</strong>
              </div>
            </div>

            <div className="map-placeholder">
              <div>
                <p>Coordinates</p>
                <h3>
                  {hasLocation ? coordinatesText : "Waiting for location"}
                </h3>
              </div>
            </div>

            <div className="action-row">
              <button onClick={openGoogleMaps} disabled={!hasLocation}>
                Open in Google Maps
              </button>

              <button onClick={copyCoordinates} disabled={!hasLocation}>
                Copy Coordinates
              </button>
            </div>
          </div>

          <div className="panel health-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Receiver Health</p>
                <h2>RTK Status</h2>
              </div>
            </div>

            <div className="details-list">
              <div>
                <span>Fix Quality</span>
                <strong>{getFixLabel(selectedStaff?.fixQuality)}</strong>
              </div>

              <div>
                <span>Satellites</span>
                <strong>{formatValue(selectedStaff?.satellites)}</strong>
              </div>

              <div>
                <span>Source</span>
                <strong>{formatValue(selectedStaff?.source)}</strong>
              </div>

              <div>
                <span>Last Seen</span>
                <strong>{secondsAgo(selectedStaff?.lastSeen)}</strong>
              </div>

              <div>
                <span>Device Time</span>
                <strong>{formatDateTime(selectedStaff?.timestamp)}</strong>
              </div>

              <div>
                <span>Server Time</span>
                <strong>{formatDateTime(selectedStaff?.serverTime)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Attendance</p>
                <h2>
                  {selectedAttendance
                    ? selectedAttendance.staffId
                    : "No Attendance Data"}
                </h2>
              </div>

              {selectedAttendance && (
                <span
                  className={`status-pill ${getAttendanceStatusClass(
                    selectedAttendance.status
                  )}`}
                >
                  {getAttendanceStatusLabel(selectedAttendance.status)}
                </span>
              )}
            </div>

            <div className="details-list">
              <div>
                <span>Clock In</span>
                <strong>
                  {selectedAttendance?.clockInLocalTime ||
                    formatDateTime(selectedAttendance?.clockIn)}
                </strong>
              </div>

              <div>
                <span>Clock Out</span>
                <strong>
                  {selectedAttendance?.clockOutLocalTime ||
                    formatDateTime(selectedAttendance?.clockOut)}
                </strong>
              </div>

              <div>
                <span>Shift</span>
                <strong>
                  {selectedAttendance
                    ? `${selectedAttendance.shiftStart} - ${selectedAttendance.shiftEnd}`
                    : "--"}
                </strong>
              </div>

              <div>
                <span>Late Status</span>
                <strong>
                  {selectedAttendance?.isLate
                    ? `Late by ${selectedAttendance.lateMinutes} min`
                    : selectedAttendance
                    ? "On Time"
                    : "--"}
                </strong>
              </div>

              <div>
                <span>Attendance Date</span>
                <strong>{formatValue(selectedAttendance?.date)}</strong>
              </div>

              <div>
                <span>Last Event</span>
                <strong>{formatValue(selectedAttendance?.lastEvent)}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Supervisor Alerts</p>
                <h2>Late / Warning Alerts</h2>
              </div>
            </div>

            <div className="details-list">
              {attendanceAlerts.length === 0 ? (
                <div>
                  <span>Status</span>
                  <strong>No alerts yet</strong>
                </div>
              ) : (
                attendanceAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.alertId}>
                    <span>
                      <span
                        className={`mini-status ${getSeverityClass(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                    </span>
                    <strong>{alert.message}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Staff Feed</p>
              <h2>All Staff Devices</h2>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Status</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Fix</th>
                  <th>Satellites</th>
                  <th>Last Seen</th>
                </tr>
              </thead>

              <tbody>
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      No staff location data received yet.
                    </td>
                  </tr>
                ) : (
                  staffList.map((staff) => (
                    <tr
                      key={staff.staffId}
                      onClick={() => setSelectedStaffId(staff.staffId)}
                      className={
                        selectedStaffId === staff.staffId ? "selected-row" : ""
                      }
                    >
                      <td>{staff.staffId}</td>
                      <td>
                        <span
                          className={`mini-status ${getStatusClass(
                            staff.status
                          )}`}
                        >
                          {staff.status}
                        </span>
                      </td>
                      <td>{formatNumber(staff.latitude, 6)}</td>
                      <td>{formatNumber(staff.longitude, 6)}</td>
                      <td>{getFixLabel(staff.fixQuality)}</td>
                      <td>{formatValue(staff.satellites)}</td>
                      <td>{secondsAgo(staff.lastSeen)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Attendance Feed</p>
              <h2>Daily Attendance Records</h2>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                  <th>Late</th>
                  <th>Last Event</th>
                </tr>
              </thead>

              <tbody>
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      No attendance data received yet.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((record) => (
                    <tr
                      key={record.attendanceId}
                      onClick={() => setSelectedStaffId(record.staffId)}
                      className={
                        selectedStaffId === record.staffId ? "selected-row" : ""
                      }
                    >
                      <td>{record.staffId}</td>
                      <td>{record.date}</td>
                      <td>
                        {record.clockInLocalTime ||
                          formatDateTime(record.clockIn)}
                      </td>
                      <td>
                        {record.clockOutLocalTime ||
                          formatDateTime(record.clockOut)}
                      </td>
                      <td>
                        <span
                          className={`mini-status ${getAttendanceStatusClass(
                            record.status
                          )}`}
                        >
                          {getAttendanceStatusLabel(record.status)}
                        </span>
                      </td>
                      <td>
                        {record.isLate
                          ? `${record.lateMinutes} min late`
                          : "On time"}
                      </td>
                      <td>{record.lastEvent}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Task Assignment</p>
              <h2>Supervisor Assigned Jobs</h2>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Site</th>
                  <th>Assigned By</th>
                  <th>Updated</th>
                </tr>
              </thead>

              <tbody>
                {selectedStaffTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      No tasks assigned yet.
                    </td>
                  </tr>
                ) : (
                  selectedStaffTasks.map((task) => (
                    <tr
                      key={task.taskId}
                      onClick={() => setSelectedStaffId(task.staffId)}
                      className={
                        selectedStaffId === task.staffId ? "selected-row" : ""
                      }
                    >
                      <td>
                        <strong>{task.title}</strong>
                        <br />
                        <span className="table-subtext">
                          {task.description || "No description"}
                        </span>
                      </td>

                      <td>{task.staffId}</td>

                      <td>
                        <span
                          className={`mini-status ${getTaskStatusClass(
                            task.status
                          )}`}
                        >
                          {getTaskStatusLabel(task.status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`mini-status ${getPriorityClass(
                            task.priority
                          )}`}
                        >
                          {formatValue(task.priority)}
                        </span>
                      </td>

                      <td>{task.siteName || "--"}</td>
                      <td>{task.assignedBy || "--"}</td>
                      <td>{secondsAgo(task.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showRawGga && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Raw Receiver Data</p>
                <h2>GGA Sentence</h2>
              </div>
            </div>

            <pre className="raw-box">{formatValue(selectedStaff?.gga)}</pre>
          </section>
        )}

        {showRawData && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Debug</p>
                <h2>API Response</h2>
              </div>
            </div>

            <pre className="raw-box">
              {JSON.stringify(
                {
                  location: dashboardData,
                  attendance: attendanceData,
                  tasks: tasksData,
                },
                null,
                2
              )}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
