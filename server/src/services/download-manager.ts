import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { getUserMusicDir, getUserTasksDir } from "./task-store.js";

const MAX_CONCURRENCY = 2;

interface DownloadJob {
  url: string;
  filePath: string;
  downloadingPath: string;
}

const queue: DownloadJob[] = [];
const activeJobs = new Set<string>();
const enqueuedPaths = new Set<string>();

function enqueue(job: DownloadJob): boolean {
  if (enqueuedPaths.has(job.downloadingPath) || activeJobs.has(job.downloadingPath)) {
    return false;
  }
  queue.push(job);
  enqueuedPaths.add(job.downloadingPath);
  drain();
  return true;
}

function drain(): void {
  while (activeJobs.size < MAX_CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!;
    enqueuedPaths.delete(job.downloadingPath);
    activeJobs.add(job.downloadingPath);
    executeDownload(job).finally(() => {
      activeJobs.delete(job.downloadingPath);
      drain();
    });
  }
}

async function executeDownload(job: DownloadJob): Promise<void> {
  try {
    // 确保目录存在
    await fs.mkdir(path.dirname(job.filePath), { recursive: true });
    console.log(`[download] 开始下载: ${path.basename(job.filePath)}`);
    const res = await fetch(job.url);
    if (!res.ok || !res.body) {
      console.error(`[download] 下载失败 (${res.status}): ${job.url}`);
      return;
    }
    const ws = createWriteStream(job.downloadingPath);
    // @ts-ignore
    await pipeline(res.body, ws);
    await fs.rename(job.downloadingPath, job.filePath);
    console.log(`[download] 下载完成: ${path.basename(job.filePath)}`);
  } catch (err) {
    await fs.unlink(job.downloadingPath).catch(() => {});
    console.error(`[download] 下载出错: ${job.url}`, err);
  }
}

// ---- Helpers ----

function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, "_").trim() || "untitled";
}

function extractTitle(input: Record<string, unknown>): string | null {
  const params = input.parameters as Record<string, unknown> | undefined;
  if (params?.title && typeof params.title === "string" && params.title.trim()) {
    return params.title.trim();
  }
  return null;
}

function buildFileName(
  taskId: string,
  input: Record<string, unknown>,
  index: number,
  total: number,
): string {
  const title = extractTitle(input);
  const prefix = title ? `${sanitizeFileName(title)}-${taskId}` : taskId;
  const suffix = total > 1 ? `-${index + 1}` : "";
  return `${prefix}${suffix}.mp3`;
}

// ---- Public API ----

export function enqueueDownload(
  username: string,
  taskId: string,
  urls: string[],
  input: Record<string, unknown>,
): void {
  const musicDir = getUserMusicDir(username);
  for (let i = 0; i < urls.length; i++) {
    const fileName = buildFileName(taskId, input, i, urls.length);
    const filePath = path.join(musicDir, fileName);
    const downloadingPath = `${filePath}.downloading`;

    fs.access(filePath)
      .then(() => {})
      .catch(() => {
        enqueue({ url: urls[i]!, filePath, downloadingPath });
      });
  }
}

export function isDownloading(downloadingPath: string): boolean {
  return activeJobs.has(downloadingPath) || enqueuedPaths.has(downloadingPath);
}

export async function finishDownload(username: string): Promise<{
  requeued: string[];
  missing: string[];
}> {
  const musicDir = getUserMusicDir(username);
  const tasksDir = getUserTasksDir(username);
  const requeued: string[] = [];
  const missing: string[] = [];

  // 1. 扫描 .downloading
  const musicFiles = await fs.readdir(musicDir).catch(() => [] as string[]);
  for (const file of musicFiles) {
    if (!file.endsWith(".downloading")) continue;
    const downloadingPath = path.join(musicDir, file);
    if (isDownloading(downloadingPath)) continue;

    const taskId = extractTaskIdFromFileName(file);
    if (!taskId) {
      await fs.unlink(downloadingPath).catch(() => {});
      continue;
    }

    const urlInfo = await getUrlsForTask(tasksDir, taskId);
    if (!urlInfo) continue;

    const index = extractIndexFromFileName(file, urlInfo.urls.length);
    if (index !== null && urlInfo.urls[index]) {
      const filePath = downloadingPath.replace(/\.downloading$/, "");
      await fs.unlink(downloadingPath).catch(() => {});
      enqueue({ url: urlInfo.urls[index]!, filePath, downloadingPath });
      requeued.push(file);
    }
  }

  // 2. 扫描 .success task，补缺
  const taskFiles = await fs.readdir(tasksDir).catch(() => [] as string[]);
  const currentMusicFiles = await fs.readdir(musicDir).catch(() => [] as string[]);

  for (const file of taskFiles) {
    if (!file.endsWith(".success")) continue;
    const taskId = file.replace(/\.success$/, "");
    const fullPath = path.join(tasksDir, file);

    let data: { input: Record<string, unknown>; result: Record<string, unknown> | null };
    try {
      const raw = await fs.readFile(fullPath, "utf-8");
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const output = data.result as any;
    const urls = output?.output?.urls as string[] | undefined;
    if (!urls || urls.length === 0) continue;

    for (let i = 0; i < urls.length; i++) {
      const fileName = buildFileName(taskId, data.input, i, urls.length);
      const filePath = path.join(musicDir, fileName);
      const downloadingPath = `${filePath}.downloading`;

      const exists = currentMusicFiles.includes(fileName);
      const downloading = currentMusicFiles.includes(`${fileName}.downloading`);
      const inQueue = isDownloading(downloadingPath);

      if (!exists && !downloading && !inQueue) {
        enqueue({ url: urls[i]!, filePath, downloadingPath });
        missing.push(fileName);
      }
    }
  }

  return { requeued, missing };
}

function extractTaskIdFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.mp3\.downloading$/, "");
  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const match = base.match(uuidRegex);
  return match ? match[1]! : null;
}

function extractIndexFromFileName(fileName: string, totalUrls: number): number | null {
  if (totalUrls <= 1) return 0;
  const match = fileName.match(/-(\d+)\.mp3\.downloading$/);
  if (match) {
    const idx = parseInt(match[1]!, 10) - 1;
    return idx >= 0 && idx < totalUrls ? idx : null;
  }
  return 0;
}

async function getUrlsForTask(
  tasksDir: string,
  taskId: string,
): Promise<{ urls: string[]; input: Record<string, unknown> } | null> {
  const taskFiles = await fs.readdir(tasksDir).catch(() => [] as string[]);
  const taskFile = taskFiles.find(
    (f) => f.startsWith(taskId) && f.endsWith(".success"),
  );
  if (!taskFile) return null;
  try {
    const raw = await fs.readFile(path.join(tasksDir, taskFile), "utf-8");
    const data = JSON.parse(raw);
    const urls = data?.result?.output?.urls as string[] | undefined;
    return urls ? { urls, input: data.input ?? {} } : null;
  } catch {
    return null;
  }
}

export function getDownloadStatus(): {
  active: number;
  queued: number;
  activeFiles: string[];
  queuedFiles: string[];
} {
  return {
    active: activeJobs.size,
    queued: queue.length,
    activeFiles: [...activeJobs].map((p) => path.basename(p)),
    queuedFiles: queue.map((j) => path.basename(j.filePath)),
  };
}
