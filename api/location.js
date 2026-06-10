let latestLocation = {
  staffId: null,
  latitude: null,
  longitude: null,
  time: null
};

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    const { staffId, latitude, longitude } = req.body;

    latestLocation = {
      staffId,
      latitude,
      longitude,
      time: new Date().toLocaleString()
    };

    return res.status(200).json({
      status: "success",
      data: latestLocation
    });
  }

  if (req.method === "GET") {
    return res.status(200).json(latestLocation);
  }

  return res.status(405).json({
    message: "Method not allowed"
  });
}