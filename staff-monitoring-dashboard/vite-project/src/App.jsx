import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [location, setLocation] = useState({
    staffId: "Loading...",
    latitude: "Loading...",
    longitude: "Loading...",
    time: "Loading...",
  });

  const [status, setStatus] = useState("Connecting...");

  const loadLocation = async () => {
    try {
      const response = await fetch(
        "https://staff-monitoring-system.vercel.app/api/location"
      );

      const data = await response.json();

      setLocation(data);
      setStatus("Live");
    } catch (error) {
      setStatus("Connection Error");
      console.error(error);
    }
  };

  useEffect(() => {
    loadLocation();
    const interval = setInterval(loadLocation, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <div className="card">
        <div className="badge">{status}</div>

        <h1>Staff Monitoring System</h1>
        <p className="subtitle">Live GPS Location Dashboard</p>

        <div className="grid">
          <div className="box">
            <span>Staff ID</span>
            <h2>{location.staffId}</h2>
          </div>

          <div className="box">
            <span>Latitude</span>
            <h2>{location.latitude}</h2>
          </div>

          <div className="box">
            <span>Longitude</span>
            <h2>{location.longitude}</h2>
          </div>

          <div className="box">
            <span>Last Updated</span>
            <h2>{location.time}</h2>
          </div>
        </div>

        <button onClick={loadLocation}>Refresh Location</button>
      </div>
    </div>
  );
}

export default App;