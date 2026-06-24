// api/tasks.js

const { supabaseRequest } = require("./_supabase");

const VALID_STATUSES = ["pending", "in_progress", "completed", "cancelled"];
const VALID_PRIORITIES = ["low", "medium", "high"];

function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function generateTaskId() {
  return `TASK-${Date.now()}`;
}

function normalizeStatus(status) {
  if (!status) return "pending";

  const normalized = String(status).toLowerCase();

  return VALID_STATUSES.includes(normalized) ? normalized : "pending";
}

function normalizePriority(priority) {
  if (!priority) return "medium";

  const normalized = String(priority).toLowerCase();

  return VALID_PRIORITIES.includes(normalized) ? normalized : "medium";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function mapTaskRow(row) {
  return {
    taskId: row.task_id,
    staffId: row.staff_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignedBy: row.assigned_by,
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    siteName: row.site_name,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  };
}

function buildResponse(rows) {
  const tasks = rows.map(mapTaskRow);

  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const inProgressCount = tasks.filter(
    (task) => task.status === "in_progress"
  ).length;
  const completedCount = tasks.filter(
    (task) => task.status === "completed"
  ).length;
  const cancelledCount = tasks.filter(
    (task) => task.status === "cancelled"
  ).length;
  const highPriorityCount = tasks.filter(
    (task) => task.priority === "high"
  ).length;

  return {
    success: true,
    count: tasks.length,
    pendingCount,
    inProgressCount,
    completedCount,
    cancelledCount,
    highPriorityCount,
    updatedAt: new Date().toISOString(),
    tasks,
  };
}

async function fetchTasks(query = {}) {
  let path = "staff_tasks?select=*&order=updated_at.desc";

  if (query.staffId) {
    path += `&staff_id=eq.${encodeURIComponent(query.staffId)}`;
  }

  if (query.status) {
    path += `&status=eq.${encodeURIComponent(query.status)}`;
  }

  return await supabaseRequest(path);
}

async function createTask(body) {
  const now = new Date().toISOString();

  const staffId = body.staffId || body.staff_id;

  if (!staffId) {
    return {
      error: true,
      statusCode: 400,
      message: "staffId is required",
    };
  }

  if (!body.title) {
    return {
      error: true,
      statusCode: 400,
      message: "title is required",
    };
  }

  const taskId = body.taskId || generateTaskId();

  const payload = {
    task_id: taskId,
    staff_id: String(staffId),
    title: String(body.title),
    description: body.description ? String(body.description) : null,
    priority: normalizePriority(body.priority),
    status: normalizeStatus(body.status),
    assigned_by: body.assignedBy || "Supervisor-1",
    assigned_to: String(staffId),
    due_date: body.dueDate || null,
    site_name: body.siteName || null,
    latitude: toNumber(body.latitude),
    longitude: toNumber(body.longitude),
    notes: body.notes || null,
    created_at: now,
    updated_at: now,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
  };

  const rows = await supabaseRequest("staff_tasks", {
    method: "POST",
    prefer: "return=representation",
    body: payload,
  });

  return {
    task: mapTaskRow(rows[0]),
  };
}

async function updateTask(body) {
  const now = new Date().toISOString();

  const taskId = body.taskId;

  if (!taskId) {
    return {
      error: true,
      statusCode: 400,
      message: "taskId is required for update",
    };
  }

  const existingRows = await supabaseRequest(
    `staff_tasks?select=*&task_id=eq.${encodeURIComponent(taskId)}&limit=1`
  );

  if (existingRows.length === 0) {
    return {
      error: true,
      statusCode: 404,
      message: "Task not found",
    };
  }

  const existingTask = existingRows[0];

  const newStatus = body.status
    ? normalizeStatus(body.status)
    : existingTask.status;

  const payload = {
    title: body.title ? String(body.title) : existingTask.title,
    description:
      body.description !== undefined
        ? body.description
        : existingTask.description,
    priority: body.priority
      ? normalizePriority(body.priority)
      : existingTask.priority,
    status: newStatus,
    due_date: body.dueDate !== undefined ? body.dueDate : existingTask.due_date,
    site_name:
      body.siteName !== undefined ? body.siteName : existingTask.site_name,
    notes: body.notes !== undefined ? body.notes : existingTask.notes,
    updated_at: now,
    started_at:
      newStatus === "in_progress" && !existingTask.started_at
        ? now
        : existingTask.started_at,
    completed_at:
      newStatus === "completed" && !existingTask.completed_at
        ? now
        : existingTask.completed_at,
    cancelled_at:
      newStatus === "cancelled" && !existingTask.cancelled_at
        ? now
        : existingTask.cancelled_at,
  };

  const rows = await supabaseRequest(
    `staff_tasks?task_id=eq.${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: payload,
    }
  );

  return {
    task: mapTaskRow(rows[0]),
  };
}

module.exports = async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const rows = await fetchTasks({
        staffId: req.query.staffId,
        status: req.query.status,
      });

      return res.status(200).json(buildResponse(rows));
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = body.action || "create";

      let result;

      if (action === "create") {
        result = await createTask(body);
      } else if (action === "update" || action === "update_status") {
        result = await updateTask(body);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid action. Use create or update.",
        });
      }

      if (result.error) {
        return res.status(result.statusCode || 400).json({
          success: false,
          message: result.message,
        });
      }

      const rows = await fetchTasks();

      return res.status(200).json({
        success: true,
        message:
          action === "create"
            ? "Task assigned successfully"
            : "Task updated successfully",
        saved: result.task,
        ...buildResponse(rows),
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