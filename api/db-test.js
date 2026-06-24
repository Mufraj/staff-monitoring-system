// api/db-test.js

const { supabaseRequest } = require("./_supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const data = await supabaseRequest("staff_locations?select=*&limit=1");

    return res.status(200).json({
      success: true,
      message: "Supabase connection working",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};