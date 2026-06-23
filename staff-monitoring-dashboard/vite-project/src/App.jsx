import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "https://staff-monitoring-system.vercel.app/api/location";
const ATTENDANCE_API_URL =
  "https://staff-monitoring-system.vercel.app/api/attendance";
const TASKS_API_URL = "https://staff-monitoring-system.vercel.app/api/tasks";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "tracking", label: "Staff Tracking", icon: "⌖" },
  { id: "attendance", label: "Attendance", icon: "◷" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "alerts", label: "Alerts", icon: "!" },
  { id: "reports", label: "Reports", icon: "↗" },
];

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
  const [activePage, setActivePage] = useState("dashboard");

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

  const [taskForm, setTaskForm] = useState({
    staffId: "Staff-1",
    title: "",
    description: "",
    priority: "medium",
    siteName: "",
    dueDate: "",
  });

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

  useEffect(() => {
    if (staffOptions.length > 0 && taskForm.staffId === "Staff-1") {
      setTaskForm((previous) => ({
        ...previous,
        staffId: staffOptions.includes("Staff-1") ? "Staff-1" : staffOptions[0],
      }));
    }
  }, [staffOptions, taskForm.staffId]);

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
  const attendanceCompletedCount = attendanceData?.completedCount || 0;
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

  const currentPageLabel =
    NAV_ITEMS.find((item) => item.id === activePage)?.label || "Dashboard";

  const recentTasks = taskList.slice(0, 5);
  const recentStaff = staffList.slice(0, 5);
  const recentAttendance = attendanceRecords.slice(0, 5);

  const handleTaskFormChange = (event) => {
    const { name, value } = event.target;

    setTaskForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const assignTask = async (event) => {
    event.preventDefault();

    if (!taskForm.staffId || !taskForm.title.trim()) {
      alert("Please select staff and enter task title.");
      return;
    }

    try {
      const response = await fetch(TASKS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          staffId: taskForm.staffId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          priority: taskForm.priority,
          assignedBy: "Supervisor-1",
          siteName: taskForm.siteName.trim(),
          dueDate: taskForm.dueDate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Task API failed with status ${response.status}`);
      }

      const data = await response.json();
      setTasksData(data);

      setTaskForm((previous) => ({
        ...previous,
        title: "",
        description: "",
        priority: "medium",
        siteName: "",
        dueDate: "",
      }));

      setActivePage("tasks");
      alert("Task assigned successfully.");
    } catch (error) {
      alert(error.message || "Unable to assign task.");
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const response = await fetch(TASKS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          taskId,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Task update failed with status ${response.status}`);
      }

      const data = await response.json();
      setTasksData(data);
    } catch (error) {
      alert(error.message || "Unable to update task.");
    }
  };

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

  const openStaff = (staffId) => {
    setSelectedStaffId(staffId);
    setActivePage("tracking");
  };

  const renderStatCards = () => (
    <>
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
          <p>Attendance Done</p>
          <h2>{attendanceCompletedCount}</h2>
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
    </>
  );

  const renderLocationPanels = () => (
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
            <h3>{hasLocation ? coordinatesText : "Waiting for location"}</h3>
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
  );

  const renderStaffTable = (items = staffList) => (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Staff Feed</p>
          <h2>All Staff Devices</h2>
        </div>

        <button className="small-action" onClick={() => setSelectedStaffId("all")}>
          Reset Filter
        </button>
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
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No staff location data received yet.
                </td>
              </tr>
            ) : (
              items.map((staff) => (
                <tr
                  key={staff.staffId}
                  onClick={() => openStaff(staff.staffId)}
                  className={selectedStaffId === staff.staffId ? "selected-row" : ""}
                >
                  <td>{staff.staffId}</td>
                  <td>
                    <span className={`mini-status ${getStatusClass(staff.status)}`}>
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
  );

  const renderAttendanceSummary = () => (
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

      {renderAlertsPanel()}
    </section>
  );

  const renderAlertsPanel = () => (
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
          attendanceAlerts.slice(0, 8).map((alert) => (
            <div key={alert.alertId}>
              <span>
                <span className={`mini-status ${getSeverityClass(alert.severity)}`}>
                  {alert.severity}
                </span>
              </span>
              <strong>{alert.message}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAttendanceTable = (items = attendanceRecords) => (
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
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No attendance data received yet.
                </td>
              </tr>
            ) : (
              items.map((record) => (
                <tr
                  key={record.attendanceId}
                  onClick={() => {
                    setSelectedStaffId(record.staffId);
                    setActivePage("attendance");
                  }}
                  className={selectedStaffId === record.staffId ? "selected-row" : ""}
                >
                  <td>{record.staffId}</td>
                  <td>{record.date}</td>
                  <td>
                    {record.clockInLocalTime || formatDateTime(record.clockIn)}
                  </td>
                  <td>
                    {record.clockOutLocalTime || formatDateTime(record.clockOut)}
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
                    {record.isLate ? `${record.lateMinutes} min late` : "On time"}
                  </td>
                  <td>{record.lastEvent}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderTaskForm = () => (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Supervisor Action</p>
          <h2>Assign New Job</h2>
        </div>
      </div>

      <form className="task-form" onSubmit={assignTask}>
        <div className="form-grid">
          <div>
            <label>Assign To</label>
            <select
              name="staffId"
              value={taskForm.staffId}
              onChange={handleTaskFormChange}
            >
              {staffOptions.length === 0 ? (
                <option value="Staff-1">Staff-1</option>
              ) : (
                staffOptions.map((staffId) => (
                  <option key={staffId} value={staffId}>
                    {staffId}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label>Priority</label>
            <select
              name="priority"
              value={taskForm.priority}
              onChange={handleTaskFormChange}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label>Task Title</label>
            <input
              name="title"
              value={taskForm.title}
              onChange={handleTaskFormChange}
              placeholder="Inspect Site A"
            />
          </div>

          <div>
            <label>Site Name</label>
            <input
              name="siteName"
              value={taskForm.siteName}
              onChange={handleTaskFormChange}
              placeholder="Office Zone"
            />
          </div>

          <div>
            <label>Due Date</label>
            <input
              type="datetime-local"
              name="dueDate"
              value={taskForm.dueDate}
              onChange={handleTaskFormChange}
            />
          </div>

          <div className="form-full">
            <label>Description</label>
            <textarea
              name="description"
              value={taskForm.description}
              onChange={handleTaskFormChange}
              placeholder="Write job details for employee..."
              rows="3"
            />
          </div>
        </div>

        <div className="action-row">
          <button type="submit">Assign Job</button>
        </div>
      </form>
    </section>
  );

  const renderTasksTable = (items = selectedStaffTasks) => (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Task Assignment</p>
          <h2>Supervisor Assigned Jobs</h2>
        </div>

        <button className="small-action" onClick={() => setSelectedStaffId("all")}>
          Show All Tasks
        </button>
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
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">
                  No tasks assigned yet.
                </td>
              </tr>
            ) : (
              items.map((task) => (
                <tr
                  key={task.taskId}
                  onClick={() => setSelectedStaffId(task.staffId)}
                  className={selectedStaffId === task.staffId ? "selected-row" : ""}
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
                      className={`mini-status ${getTaskStatusClass(task.status)}`}
                    >
                      {getTaskStatusLabel(task.status)}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`mini-status ${getPriorityClass(task.priority)}`}
                    >
                      {formatValue(task.priority)}
                    </span>
                  </td>

                  <td>{task.siteName || "--"}</td>
                  <td>{task.assignedBy || "--"}</td>
                  <td>{secondsAgo(task.updatedAt)}</td>

                  <td>
                    <div className="task-actions" onClick={(event) => event.stopPropagation()}>
                      {task.status === "pending" && (
                        <button
                          onClick={() =>
                            updateTaskStatus(task.taskId, "in_progress")
                          }
                        >
                          Start
                        </button>
                      )}

                      {task.status !== "completed" &&
                        task.status !== "cancelled" && (
                          <button
                            onClick={() =>
                              updateTaskStatus(task.taskId, "completed")
                            }
                          >
                            Complete
                          </button>
                        )}

                      {task.status !== "completed" &&
                        task.status !== "cancelled" && (
                          <button
                            className="danger-button"
                            onClick={() =>
                              updateTaskStatus(task.taskId, "cancelled")
                            }
                          >
                            Cancel
                          </button>
                        )}

                      {(task.status === "completed" ||
                        task.status === "cancelled") && (
                        <span className="table-subtext">Closed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderDashboard = () => (
    <>
      {renderStatCards()}
      {renderLocationPanels()}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent Tasks</p>
              <h2>Priority Work</h2>
            </div>

            <button className="small-action" onClick={() => setActivePage("tasks")}>
              Open Tasks
            </button>
          </div>

          <div className="compact-list">
            {recentTasks.length === 0 ? (
              <p className="empty-text">No task data yet.</p>
            ) : (
              recentTasks.map((task) => (
                <button
                  key={task.taskId}
                  className="compact-item"
                  onClick={() => {
                    setSelectedStaffId(task.staffId);
                    setActivePage("tasks");
                  }}
                >
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.staffId} • {task.siteName || "No site"}</small>
                  </span>
                  <span className={`mini-status ${getTaskStatusClass(task.status)}`}>
                    {getTaskStatusLabel(task.status)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {renderAlertsPanel()}
      </section>

      {renderStaffTable(recentStaff)}
    </>
  );

  const renderTrackingPage = () => (
    <>
      <section className="stats-grid">
        <div className="stat-card">
          <p>Total Staff</p>
          <h2>{totalStaff}</h2>
          <span>All tracked staff</span>
        </div>

        <div className="stat-card success">
          <p>Online</p>
          <h2>{onlineCount}</h2>
          <span>Live devices</span>
        </div>

        <div className="stat-card danger">
          <p>Offline</p>
          <h2>{offlineCount}</h2>
          <span>Missing recent signal</span>
        </div>

        <div className="stat-card">
          <p>Selected</p>
          <h2>{selectedStaffId === "all" ? "Latest" : selectedStaffId}</h2>
          <span>Map and receiver view</span>
        </div>
      </section>

      {renderLocationPanels()}
      {renderStaffTable()}
    </>
  );

  const renderAttendancePage = () => (
    <>
      <section className="stats-grid">
        <div className="stat-card success">
          <p>On Duty</p>
          <h2>{onDutyCount}</h2>
          <span>Currently clocked in</span>
        </div>

        <div className="stat-card">
          <p>Completed</p>
          <h2>{attendanceCompletedCount}</h2>
          <span>Finished shifts</span>
        </div>

        <div className="stat-card danger">
          <p>Late</p>
          <h2>{lateCount}</h2>
          <span>Late arrivals</span>
        </div>

        <div className="stat-card danger">
          <p>Alerts</p>
          <h2>{alertCount}</h2>
          <span>Attendance warnings</span>
        </div>
      </section>

      {renderAttendanceSummary()}
      {renderAttendanceTable()}
    </>
  );

  const renderTasksPage = () => (
    <>
      <section className="stats-grid">
        <div className="stat-card">
          <p>Pending Tasks</p>
          <h2>{pendingTaskCount}</h2>
          <span>Waiting to start</span>
        </div>

        <div className="stat-card success">
          <p>In Progress</p>
          <h2>{inProgressTaskCount}</h2>
          <span>Currently being handled</span>
        </div>

        <div className="stat-card">
          <p>Completed</p>
          <h2>{completedTaskCount}</h2>
          <span>Finished jobs</span>
        </div>

        <div className="stat-card danger">
          <p>High Priority</p>
          <h2>{highPriorityTaskCount}</h2>
          <span>Needs attention</span>
        </div>
      </section>

      {renderTaskForm()}
      {renderTasksTable()}
    </>
  );

  const renderAlertsPage = () => (
    <>
      <section className="stats-grid">
        <div className="stat-card danger">
          <p>Total Alerts</p>
          <h2>{alertCount}</h2>
          <span>Warnings generated</span>
        </div>

        <div className="stat-card danger">
          <p>Late Staff</p>
          <h2>{lateCount}</h2>
          <span>Attendance issue</span>
        </div>

        <div className="stat-card danger">
          <p>Offline Staff</p>
          <h2>{offlineCount}</h2>
          <span>Tracking issue</span>
        </div>

        <div className="stat-card">
          <p>High Priority Tasks</p>
          <h2>{highPriorityTaskCount}</h2>
          <span>Task issue</span>
        </div>
      </section>

      <section className="content-grid">
        {renderAlertsPanel()}

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">System Health</p>
              <h2>Attention Summary</h2>
            </div>
          </div>

          <div className="details-list">
            <div>
              <span>Offline Devices</span>
              <strong>{offlineCount}</strong>
            </div>

            <div>
              <span>Late Records</span>
              <strong>{lateCount}</strong>
            </div>

            <div>
              <span>High Priority Jobs</span>
              <strong>{highPriorityTaskCount}</strong>
            </div>

            <div>
              <span>Last Sync</span>
              <strong>{formatDateTime(new Date().toISOString())}</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const renderReportsPage = () => (
    <>
      {renderStatCards()}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Report Summary</p>
              <h2>Operational Overview</h2>
            </div>
          </div>

          <div className="details-list">
            <div>
              <span>Staff Coverage</span>
              <strong>{totalStaff} staff records</strong>
            </div>

            <div>
              <span>Attendance Records</span>
              <strong>{attendanceRecords.length}</strong>
            </div>

            <div>
              <span>Assigned Jobs</span>
              <strong>{taskList.length}</strong>
            </div>

            <div>
              <span>Alerts</span>
              <strong>{alertCount}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Quick Notes</p>
              <h2>Supervisor Insight</h2>
            </div>
          </div>

          <div className="details-list">
            <div>
              <span>Tracking</span>
              <strong>{onlineCount} online / {offlineCount} offline</strong>
            </div>

            <div>
              <span>Attendance</span>
              <strong>{onDutyCount} on duty / {lateCount} late</strong>
            </div>

            <div>
              <span>Tasks</span>
              <strong>{pendingTaskCount} pending / {completedTaskCount} complete</strong>
            </div>

            <div>
              <span>Priority</span>
              <strong>{highPriorityTaskCount} high priority jobs</strong>
            </div>
          </div>
        </div>
      </section>

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
    </>
  );

  const renderActivePage = () => {
    if (activePage === "tracking") return renderTrackingPage();
    if (activePage === "attendance") return renderAttendancePage();
    if (activePage === "tasks") return renderTasksPage();
    if (activePage === "alerts") return renderAlertsPage();
    if (activePage === "reports") return renderReportsPage();

    return renderDashboard();
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
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>API</span>
          <strong>Connected</strong>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{currentPageLabel}</p>
            <h1>Staff Monitoring System</h1>
            <p className="subtitle">
              Supervisor dashboard for RTK BLE location, attendance, task
              assignment, alerts, and reports.
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
              Show Raw API JSON in Reports
            </label>
          </section>
        )}

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        {renderActivePage()}

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
      </main>
    </div>
  );
}

export default App;
