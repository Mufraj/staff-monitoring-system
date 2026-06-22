import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "https://staff-monitoring-system.vercel.app/api/location";

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

function App() {
  const [dashboardData, setDashboardData] = useState(null);
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
        throw new Error(`API failed with status ${response.status}`);
      }

      const data = await response.json();

      setDashboardData(data);
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch location data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();

    const timer = setInterval(fetchLocation, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [fetchLocation, refreshInterval]);

  const staffList = useMemo(() => {
    return dashboardData?.staff || [];
  }, [dashboardData]);

  const selectedStaff = useMemo(() => {
    if (selectedStaffId === "all") {
      return dashboardData?.latest || staffList[0] || null;
    }

    return (
      staffList.find((staff) => staff.staffId === selectedStaffId) ||
      dashboardData?.latest ||
      null
    );
  }, [dashboardData, selectedStaffId, staffList]);

  const onlineCount = dashboardData?.onlineCount || 0;
  const offlineCount = dashboardData?.offlineCount || 0;
  const totalStaff = dashboardData?.count || staffList.length || 0;

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
          <button className="nav-item">Receiver Health</button>
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
              Supervisor dashboard for RTK BLE receiver location tracking
            </p>
          </div>

          <div className="topbar-actions">
            <span
              className={`status-pill ${getStatusClass(
                selectedStaff?.status || "offline"
              )}`}
            >
              {selectedStaff?.status === "online" ? "Live" : "Offline"}
            </span>

            <button className="icon-button" onClick={fetchLocation}>
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

                {staffList.map((staff) => (
                  <option key={staff.staffId} value={staff.staffId}>
                    {staff.staffId}
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
                    <td colSpan="7" className="empty-cell">
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
              {JSON.stringify(dashboardData, null, 2)}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;