import { Router } from "express";
import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { submitTask, queryTaskStatus } from "../services/suno-api.js";
import { parseFile } from "music-metadata";
import {
  createTask,
  updateTaskStatus,
  listTasks,
  getTaskInput,
  getUserMusicDir,
  getUserTasksDir,
  ensureUserDirs,
} from "../services/task-store.js";
import {
  enqueueDownload,
  finishDownload,
  getDownloadStatus,
} from "../services/download-manager.js";
import { getUserConfig } from "../services/user-config.js";

const router = Router();

/**
 * 从数据库获取当前用户的 Suno API Key
 */
async function getSunoAuth(req: Request): Promise<string | null> {
  const apiKey = await getUserConfig(req.user!.userId, "api_key");
  if (!apiKey) return null;
  return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
}

// ============================================
// POST /api/v1/tasks/submit
// ============================================
router.post("/v1/tasks/submit", async (req: Request, res: Response) => {
  try {
    const auth = await getSunoAuth(req);
    if (!auth) {
      res.status(400).json({ error: "请先在设置中配置 API Key" });
      return;
    }

    const username = req.user!.username;
    const result = await submitTask(req.body, auth);

    if (result.status < 200 || result.status >= 300) {
      res.status(result.status).json(result.body);
      return;
    }

    const body = result.body as { output?: { task_id?: string } };
    const taskId = body?.output?.task_id;
    if (taskId) {
      await createTask(username, taskId, req.body).catch((err) => {
        console.error("[suno-route] 创建 task 文件失败:", err);
      });
    }

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[suno-route] submit 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// GET /api/v1/tasks/status
// ============================================
router.get("/v1/tasks/status", async (req: Request, res: Response) => {
  try {
    const auth = await getSunoAuth(req);
    if (!auth) {
      res.status(400).json({ error: "请先在设置中配置 API Key" });
      return;
    }

    const username = req.user!.username;
    const taskId = req.query.task_id as string;
    if (!taskId) {
      res.status(400).json({ error: "缺少 task_id 参数" });
      return;
    }

    const result = await queryTaskStatus(taskId, auth);

    if (result.status < 200 || result.status >= 300) {
      res.status(result.status).json(result.body);
      return;
    }

    const body = result.body as {
      output?: { task_status?: string; error_message?: string };
    };
    const status = body?.output?.task_status;

    if (status && taskId) {
      let resultData: Record<string, unknown> | undefined;

      if (status === "Success") {
        resultData = result.body as Record<string, unknown>;
        const output = (result.body as any)?.output;
        const urls = output?.urls as string[] | undefined;
        if (urls && urls.length > 0) {
          const input = await getTaskInput(username, taskId);
          enqueueDownload(username, taskId, urls, input);
        }
      } else if (status === "Failure") {
        resultData = {
          error_message: body?.output?.error_message ?? "Unknown error",
        };
      }

      await updateTaskStatus(username, taskId, status, resultData).catch((err) => {
        console.error("[suno-route] 更新 task 文件失败:", err);
      });
    }

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[suno-route] status 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// GET /api/v1/tasks/list
// ============================================
router.get("/v1/tasks/list", async (req: Request, res: Response) => {
  try {
    const tasks = await listTasks(req.user!.username);
    res.json({ tasks });
  } catch (err) {
    console.error("[suno-route] listTasks 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// POST /api/v1/tasks/finishDownload
// ============================================
router.post("/v1/tasks/finishDownload", async (req: Request, res: Response) => {
  try {
    const result = await finishDownload(req.user!.username);
    const status = getDownloadStatus();
    res.json({ ...result, downloadStatus: status });
  } catch (err) {
    console.error("[suno-route] finishDownload 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// GET /api/v1/history
// ============================================

const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

interface HistoryTrack {
  index: number;
  fileName: string;
  url: string;
  size: number;
  duration: number | null;
}

interface HistoryItem {
  taskId: string;
  title: string;
  mode: string;
  instrumental: boolean;
  tags: string;
  createdAt: string;
  input: Record<string, any>;
  tracks: HistoryTrack[];
}

router.get("/v1/history", async (req: Request, res: Response) => {
  try {
    const username = req.user!.username;
    const musicDir = getUserMusicDir(username);
    const tasksDir = getUserTasksDir(username);
    await ensureUserDirs(username);

    // 1. 读取用户的 .mp3 文件
    const allFiles = await fs.readdir(musicDir).catch(() => [] as string[]);
    const mp3Files = allFiles.filter(
      (f) => f.endsWith(".mp3") && !f.endsWith(".downloading"),
    );

    // 2. 按 taskId 分组
    const grouped = new Map<string, { fileName: string; index: number }[]>();

    for (const fileName of mp3Files) {
      const base = fileName.replace(/\.mp3$/, "");
      const match = base.match(UUID_RE);
      if (!match) continue;
      const taskId = match[1]!;
      const idxMatch = base.match(/-(\d+)$/);
      const index = idxMatch ? parseInt(idxMatch[1]!, 10) : 1;

      if (!grouped.has(taskId)) grouped.set(taskId, []);
      grouped.get(taskId)!.push({ fileName, index });
    }

    // 3. 构建 history
    const history: HistoryItem[] = [];

    for (const [taskId, files] of grouped) {
      files.sort((a, b) => a.index - b.index);

      let input: Record<string, any> = {};
      try {
        const taskFilePath = path.join(tasksDir, `${taskId}.success`);
        const raw = await fs.readFile(taskFilePath, "utf-8");
        const taskData = JSON.parse(raw);
        input = taskData.input ?? {};
      } catch {}

      let title = "";
      const params = input.parameters as Record<string, any> | undefined;
      if (params?.title && typeof params.title === "string" && params.title.trim()) {
        title = params.title.trim();
      } else {
        const inp = input.input as Record<string, any> | undefined;
        if (inp?.gpt_description_prompt && typeof inp.gpt_description_prompt === "string") {
          title = inp.gpt_description_prompt.trim().slice(0, 30);
        }
      }

      const metadata = input.metadata as Record<string, any> | undefined;
      const mode = metadata?.create_mode ?? "inspiration";
      const instrumental = params?.make_instrumental === true;
      const tags = (params?.tags as string) ?? "";

      const tracks: HistoryTrack[] = [];
      let earliestBirthtime: Date | null = null;

      for (const file of files) {
        const filePath = path.join(musicDir, file.fileName);
        try {
          const stat = await fs.stat(filePath);
          let duration: number | null = null;
          try {
            const meta = await parseFile(filePath, { duration: true });
            duration = meta.format.duration ?? null;
          } catch {}
          tracks.push({
            index: file.index,
            fileName: file.fileName,
            url: `/music/${username}/${file.fileName}`,
            size: stat.size,
            duration,
          });
          if (!earliestBirthtime || stat.birthtime < earliestBirthtime) {
            earliestBirthtime = stat.birthtime;
          }
        } catch {}
      }

      if (tracks.length === 0) continue;

      history.push({
        taskId,
        title,
        mode,
        instrumental,
        tags,
        createdAt: earliestBirthtime?.toISOString() ?? new Date().toISOString(),
        input,
        tracks,
      });
    }

    history.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json({ history });
  } catch (err) {
    console.error("[suno-route] history 错误:", err);
    res.status(500).json({ error: "获取历史记录失败" });
  }
});

export default router;
