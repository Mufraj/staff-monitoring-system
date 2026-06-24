// api/auth.js

const crypto = require("crypto");
const { supabaseRequest } = require("./_supabase");

const VALID_ROLES = ["admin", "supervisor", "staff"];

function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function mapUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findUserByEmail(email) {
  const rows = await supabaseRequest(
    `app_users?select=*&email=eq.${encodeURIComponent(email)}&limit=1`
  );

  return rows[0] || null;
}

async function updateLastLogin(userId) {
  const now = new Date().toISOString();

  const rows = await supabaseRequest(
    `app_users?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        last_login_at: now,
        updated_at: now,
      },
    }
  );

  return rows[0] || null;
}

function createDemoSession(user) {
  return {
    token: Buffer.from(
      `${user.userId}:${user.role}:${Date.now()}`
    ).toString("base64"),
    user,
  };
}

module.exports = async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        message: "Auth API is running",
        endpoints: {
          login: "POST /api/auth",
        },
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }

    const body = req.body || {};

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const expectedRole = String(body.role || "").toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!expectedRole || !VALID_ROLES.includes(expectedRole)) {
      return res.status(400).json({
        success: false,
        message: "Valid role is required",
      });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    if (user.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: `This account is not allowed to access ${expectedRole} panel`,
      });
    }

    if (!user.password_hash) {
      return res.status(403).json({
        success: false,
        message: "Password is not configured for this account",
      });
    }

    const incomingPasswordHash = hashPassword(password);

    if (incomingPasswordHash !== user.password_hash) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const updatedUser = await updateLastLogin(user.user_id);
    const safeUser = mapUser(updatedUser || user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      session: createDemoSession(safeUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};