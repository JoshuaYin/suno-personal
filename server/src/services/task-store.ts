import fs from "node:fs/promises";
import path from "node:path";

const SUNO_DATA_DIR = "/data/suno";

const VALID_EXTENSIONS = ["idle", "pending", "running", "success", "failure"];

/** 获取用户专属目录路径 */
function userDir(username: string) {
  const base = path.join(SUNO_DATA_DIR, username);
  return {
    base,
    tasks: path.join(base, "tasks"),
    music: path.join(base, "music"),
  };
}

/** 文件内的 JSON 结构 */
interface TaskFileData {
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

/**
 * 确保某用户的数据目录存在
 */
export async function ensureUserDirs(username: string): Promise<void> {
  const dirs = userDir(username);
  await fs.mkdir(dirs.tasks, { recursive: true });
  await fs.mkdir(dirs.music, { recursive: true });
}

/**
 * 启动时确保根目录存在（不再创建固定子目录）
 */
export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(SUNO_DATA_DIR, { recursive: true });
  console.log(`[task-store] 数据根目录就绪: ${SUNO_DATA_DIR}`);
}

/**
 * 创建 idle 状态的 task 文件
 */
export async function createTask(
  username: string,
  taskId: string,
  inputBody: Record<string, unknown>,
): Promise<void> {
  const dirs = userDir(username);
  await ensureUserDirs(username);
  const filePath = path.join(dirs.tasks, `${taskId}.idle`);
  const data: TaskFileData = { input: inputBody, result: null };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[task-store] [${username}] 创建任务: ${taskId}.idle`);
}

/**
 * 查找某个 taskId 当前的文件
 */
async function findTaskFile(
  username: string,
  taskId: string,
): Promise<{ fullPath: string; ext: string } | null> {
  const { tasks } = userDir(username);
  const files = await fs.readdir(tasks).catch(() => [] as string[]);
  for (const file of files) {
    const dotIdx = file.indexOf(".");
    if (dotIdx === -1) continue;
    const name = file.slice(0, dotIdx);
    const ext = file.slice(dotIdx + 1);
    if (name === taskId && VALID_EXTENSIONS.includes(ext)) {
      return { fullPath: path.join(tasks, file), ext };
    }
  }
  return null;
}

async function readTaskData(filePath: string): Promise<TaskFileData> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TaskFileData;
  } catch {
    return { input: {}, result: null };
  }
}

/**
 * 更新 task 状态
 */
export async function updateTaskStatus(
  username: string,
  taskId: string,
  newStatus: string,
  resultData?: Record<string, unknown>,
): Promise<void> {
  const statusMap: Record<string, string> = {
    Pending: "pending",
    Running: "running",
    Success: "success",
    Failure: "failure",
  };

  const ext = statusMap[newStatus];
  if (!ext) {
    console.warn(`[task-store] 未知状态: ${newStatus}，跳过`);
    return;
  }

  const { tasks } = userDir(username);
  const newPath = path.join(tasks, `${taskId}.${ext}`);

  const existing = await findTaskFile(username, taskId);
  let data: TaskFileData = { input: {}, result: null };

  if (existing) {
    data = await readTaskData(existing.fullPath);
    if (existing.fullPath !== newPath) {
      await fs.unlink(existing.fullPath).catch(() => {});
    }
  }

  if (resultData !== undefined) {
    data.result = resultData;
  }

  await fs.writeFile(newPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[task-store] [${username}] 更新任务: ${taskId}.${ext}`);
}

export interface TaskListItem {
  taskId: string;
  input: Record<string, unknown>;
  status: string;
  result: Record<string, unknown> | null;
  localPaths?: string[];
  createdAt: string;
}

export async function listTasks(username: string): Promise<TaskListItem[]> {
  const dirs = userDir(username);
  await ensureUserDirs(username);

  const [taskFiles, musicFiles] = await Promise.all([
    fs.readdir(dirs.tasks),
    fs.readdir(dirs.music).catch(() => [] as string[]),
  ]);

  const items: TaskListItem[] = [];

  for (const file of taskFiles) {
    const dotIdx = file.indexOf(".");
    if (dotIdx === -1) continue;
    const taskId = file.slice(0, dotIdx);
    const ext = file.slice(dotIdx + 1);
    if (!VALID_EXTENSIONS.includes(ext)) continue;

    const fullPath = path.join(dirs.tasks, file);
    const [stat, data] = await Promise.all([
      fs.stat(fullPath),
      readTaskData(fullPath),
    ]);

    const item: TaskListItem = {
      taskId,
      input: data.input,
      status: ext,
      result: data.result,
      createdAt: stat.birthtime.toISOString(),
    };

    if (ext === "success") {
      const matched = musicFiles
        .filter((f) => f.includes(taskId) && f.endsWith(".mp3"))
        .map((f) => path.join(dirs.music, f));
      if (matched.length > 0) item.localPaths = matched;
    }

    items.push(item);
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export async function getTaskInput(
  username: string,
  taskId: string,
): Promise<Record<string, unknown>> {
  const existing = await findTaskFile(username, taskId);
  if (!existing) return {};
  const data = await readTaskData(existing.fullPath);
  return data.input;
}

/** 获取用户的 music 目录路径 */
export function getUserMusicDir(username: string): string {
  return userDir(username).music;
}

/** 获取用户的 tasks 目录路径 */
export function getUserTasksDir(username: string): string {
  return userDir(username).tasks;
}
