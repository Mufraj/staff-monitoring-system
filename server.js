const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

let latestLocation = {
    staffId: null,
    latitude: null,
    longitude: null,
    time: null
};

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Staff Monitoring Backend is running");
});

app.post("/location", (req, res) => {

    const { staffId, latitude, longitude } = req.body;

    latestLocation = {
        staffId,
        latitude,
        longitude,
        time: new Date().toLocaleString()
    };

    console.log("Location received:", latestLocation);

    res.status(200).json({
        status: "success",
        message: "Location received successfully",
        data: latestLocation
    });
});

app.get("/location/latest", (req, res) => {
    res.json(latestLocation);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});