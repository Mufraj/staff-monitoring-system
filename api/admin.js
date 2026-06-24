// api/admin.js

const { supabaseRequest } = require("./_supabase");

const VALID_ROLES = ["admin", "supervisor", "staff"];
const VALID_STATUS = ["active", "inactive"];

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

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  return VALID_ROLES.includes(value) ? value : "staff";
}

function normalizeStatus(status) {
  const value = String(status || "active").toLowerCase();
  return VALID_STATUS.includes(value) ? value : "active";
}

function generateUserId(role) {
  const prefix =
    role === "admin" ? "ADMIN" : role === "supervisor" ? "SUP" : "Staff";

  return `${prefix}-${Date.now()}`;
}

function generateSiteId() {
  return `SITE-${Date.now()}`;
}

function mapUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSite(row) {
  return {
    siteId: row.site_id,
    siteName: row.site_name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row) {
  return {
    supervisorId: row.supervisor_id,
    staffId: row.staff_id,
    siteId: row.site_id,
    status: row.status,
    assignedAt: row.assigned_at,
    updatedAt: row.updated_at,
  };
}

async function fetchAdminData() {
  const usersRows = await supabaseRequest(
    "app_users?select=*&order=created_at.desc"
  );

  const sitesRows = await supabaseRequest(
    "sites?select=*&order=created_at.desc"
  );

  const assignmentRows = await supabaseRequest(
    "supervisor_staff?select=*&order=assigned_at.desc"
  );

  const users = usersRows.map(mapUser);
  const sites = sitesRows.map(mapSite);
  const assignments = assignmentRows.map(mapAssignment);

  const admins = users.filter((user) => user.role === "admin");
  const supervisors = users.filter((user) => user.role === "supervisor");
  const staff = users.filter((user) => user.role === "staff");

  return {
    success: true,
    updatedAt: new Date().toISOString(),
    summary: {
      totalUsers: users.length,
      totalAdmins: admins.length,
      totalSupervisors: supervisors.length,
      totalStaff: staff.length,
      totalSites: sites.length,
      totalAssignments: assignments.length,
      activeUsers: users.filter((user) => user.status === "active").length,
      inactiveUsers: users.filter((user) => user.status === "inactive").length,
    },
    users,
    admins,
    supervisors,
    staff,
    sites,
    assignments,
  };
}

async function createOrUpdateUser(body) {
  const now = new Date().toISOString();

  const role = normalizeRole(body.role);
  const userId = body.userId || body.user_id || generateUserId(role);

  if (!body.fullName && !body.full_name) {
    return {
      error: true,
      statusCode: 400,
      message: "fullName is required",
    };
  }

  const payload = {
    user_id: String(userId),
    full_name: String(body.fullName || body.full_name),
    email: body.email || null,
    phone: body.phone || null,
    role,
    status: normalizeStatus(body.status),
    updated_at: now,
  };

  const rows = await supabaseRequest("app_users?on_conflict=user_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: payload,
  });

  return {
    user: mapUser(rows[0]),
  };
}

async function createOrUpdateSite(body) {
  const now = new Date().toISOString();

  const siteId = body.siteId || body.site_id || generateSiteId();

  if (!body.siteName && !body.site_name) {
    return {
      error: true,
      statusCode: 400,
      message: "siteName is required",
    };
  }

  const payload = {
    site_id: String(siteId),
    site_name: String(body.siteName || body.site_name),
    address: body.address || null,
    latitude: toNumber(body.latitude),
    longitude: toNumber(body.longitude),
    status: normalizeStatus(body.status),
    updated_at: now,
  };

  const rows = await supabaseRequest("sites?on_conflict=site_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: payload,
  });

  return {
    site: mapSite(rows[0]),
  };
}

async function assignStaffToSupervisor(body) {
  const now = new Date().toISOString();

  const supervisorId = body.supervisorId || body.supervisor_id;
  const staffId = body.staffId || body.staff_id;

  if (!supervisorId) {
    return {
      error: true,
      statusCode: 400,
      message: "supervisorId is required",
    };
  }

  if (!staffId) {
    return {
      error: true,
      statusCode: 400,
      message: "staffId is required",
    };
  }

  const payload = {
    supervisor_id: String(supervisorId),
    staff_id: String(staffId),
    site_id: body.siteId || body.site_id || null,
    status: normalizeStatus(body.status),
    updated_at: now,
  };

  const rows = await supabaseRequest(
    "supervisor_staff?on_conflict=supervisor_id,staff_id",
    {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: payload,
    }
  );

  return {
    assignment: mapAssignment(rows[0]),
  };
}

module.exports = async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const data = await fetchAdminData();
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = body.action;

      if (!action) {
        return res.status(400).json({
          success: false,
          message:
            "action is required. Use create_user, create_site, or assign_staff.",
        });
      }

      let result;

      if (action === "create_user" || action === "update_user") {
        result = await createOrUpdateUser(body);
      } else if (action === "create_site" || action === "update_site") {
        result = await createOrUpdateSite(body);
      } else if (action === "assign_staff") {
        result = await assignStaffToSupervisor(body);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid action.",
        });
      }

      if (result.error) {
        return res.status(result.statusCode || 400).json({
          success: false,
          message: result.message,
        });
      }

      const data = await fetchAdminData();

      return res.status(200).json({
        success: true,
        message: "Admin action completed successfully",
        saved: result,
        ...data,
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