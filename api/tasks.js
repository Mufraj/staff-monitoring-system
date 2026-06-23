// api/tasks.js

const VALID_STATUSES = ["pending", "in_progress", "completed", "cancelled"];
const VALID_PRIORITIES = ["low", "medium", "high"];

globalThis.staffTasks = globalThis.staffTasks || {};

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

function buildTaskList() {
  return Object.values(globalThis.staffTasks).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}

function buildResponse() {
  const tasks = buildTaskList();

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

function createTask(body) {
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

  const task = {
    taskId,
    staffId: String(staffId),

    title: String(body.title),
    description: body.description ? String(body.description) : null,

    priority: normalizePriority(body.priority),
    status: normalizeStatus(body.status),

    assignedBy: body.assignedBy || "Supervisor-1",
    assignedTo: String(staffId),

    dueDate: body.dueDate || null,
    siteName: body.siteName || null,

    latitude:
      body.latitude !== undefined && body.latitude !== null
        ? Number(body.latitude)
        : null,
    longitude:
      body.longitude !== undefined && body.longitude !== null
        ? Number(body.longitude)
        : null,

    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,

    notes: body.notes || null,
  };

  globalThis.staffTasks[taskId] = task;

  return { task };
}

function updateTask(body) {
  const now = new Date().toISOString();

  const taskId = body.taskId;

  if (!taskId) {
    return {
      error: true,
      statusCode: 400,
      message: "taskId is required for update",
    };
  }

  const existingTask = globalThis.staffTasks[taskId];

  if (!existingTask) {
    return {
      error: true,
      statusCode: 404,
      message: "Task not found",
    };
  }

  const newStatus = body.status
    ? normalizeStatus(body.status)
    : existingTask.status;

  const updatedTask = {
    ...existingTask,

    title: body.title ? String(body.title) : existingTask.title,
    description:
      body.description !== undefined
        ? body.description
        : existingTask.description,

    priority: body.priority
      ? normalizePriority(body.priority)
      : existingTask.priority,

    status: newStatus,
    dueDate: body.dueDate !== undefined ? body.dueDate : existingTask.dueDate,
    siteName:
      body.siteName !== undefined ? body.siteName : existingTask.siteName,

    notes: body.notes !== undefined ? body.notes : existingTask.notes,

    updatedAt: now,

    startedAt:
      newStatus === "in_progress" && !existingTask.startedAt
        ? now
        : existingTask.startedAt,

    completedAt:
      newStatus === "completed" && !existingTask.completedAt
        ? now
        : existingTask.completedAt,

    cancelledAt:
      newStatus === "cancelled" && !existingTask.cancelledAt
        ? now
        : existingTask.cancelledAt,
  };

  globalThis.staffTasks[taskId] = updatedTask;

  return { task: updatedTask };
}

module.exports = function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const { staffId, status } = req.query;

    let tasks = buildTaskList();

    if (staffId) {
      tasks = tasks.filter((task) => task.staffId === staffId);
    }

    if (status) {
      tasks = tasks.filter((task) => task.status === status);
    }

    return res.status(200).json({
      ...buildResponse(),
      count: tasks.length,
      tasks,
    });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const action = body.action || "create";

    let result;

    if (action === "create") {
      result = createTask(body);
    } else if (action === "update" || action === "update_status") {
      result = updateTask(body);
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

    return res.status(200).json({
      success: true,
      message:
        action === "create"
          ? "Task assigned successfully"
          : "Task updated successfully",
      saved: result.task,
      ...buildResponse(),
    });
  }

  return res.status(405).json({
    success: false,
    message: "Method not allowed",
  });
};