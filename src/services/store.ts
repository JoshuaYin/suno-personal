import type { TaskRecord, MVTaskRecord } from "@/types";

const STORAGE_KEY = "suno_tasks";

/** 读取所有任务记录 */
export function loadTasks(): TaskRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TaskRecord[];
  } catch {
    return [];
  }
}

/** 保存所有任务记录 */
export function saveTasks(tasks: TaskRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/** 添加一条任务记录 */
export function addTask(task: TaskRecord): void {
  const tasks = loadTasks();
  tasks.unshift(task);
  saveTasks(tasks);
}

/** 更新一条任务记录 */
export function updateTask(
  taskId: string,
  patch: Partial<TaskRecord>,
): void {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.taskId === taskId);
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx]!, ...patch };
    saveTasks(tasks);
  }
}

/** 删除一条任务记录 */
export function removeTask(taskId: string): void {
  const tasks = loadTasks().filter((t) => t.taskId !== taskId);
  saveTasks(tasks);
}

// ============================================
// MV 任务记录
// ============================================

const MV_STORAGE_KEY = "mv_tasks";

/** 读取所有 MV 任务记录 */
export function loadMVTasks(): MVTaskRecord[] {
  try {
    const raw = localStorage.getItem(MV_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MVTaskRecord[];
  } catch {
    return [];
  }
}

/** 保存所有 MV 任务记录 */
export function saveMVTasks(tasks: MVTaskRecord[]): void {
  localStorage.setItem(MV_STORAGE_KEY, JSON.stringify(tasks));
}

/** 添加一条 MV 任务记录 */
export function addMVTask(task: MVTaskRecord): void {
  const tasks = loadMVTasks();
  tasks.unshift(task);
  saveMVTasks(tasks);
}

/** 更新一条 MV 任务记录 */
export function updateMVTask(
  taskId: string,
  patch: Partial<MVTaskRecord>,
): void {
  const tasks = loadMVTasks();
  const idx = tasks.findIndex((t) => t.taskId === taskId);
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx]!, ...patch };
    saveMVTasks(tasks);
  }
}

/** 删除一条 MV 任务记录 */
export function removeMVTask(taskId: string): void {
  const tasks = loadMVTasks().filter((t) => t.taskId !== taskId);
  saveMVTasks(tasks);
}
