import type {
  SubmitBody,
  MVSubmitBody,
  SubmitResponse,
  TaskStatusResponse,
  HistoryResponse,
} from "@/types";
import { authFetch } from "./auth";

const API_BASE = "/api";

// ============================================
// 异步提交任务
// ============================================

export async function submitTask(body: SubmitBody | MVSubmitBody): Promise<SubmitResponse> {
  const res = await authFetch(`${API_BASE}/v1/tasks/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`提交任务失败 (${res.status}): ${text}`);
  }

  return res.json() as Promise<SubmitResponse>;
}

// ============================================
// 查询任务状态
// ============================================

export async function getTaskStatus(
  taskId: string,
): Promise<TaskStatusResponse> {
  const res = await authFetch(`${API_BASE}/v1/tasks/status?task_id=${taskId}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`查询任务失败 (${res.status}): ${text}`);
  }

  return res.json() as Promise<TaskStatusResponse>;
}

// ============================================
// 获取历史记录
// ============================================

export async function getHistory(): Promise<HistoryResponse> {
  const res = await authFetch(`${API_BASE}/v1/history`);
  if (!res.ok) throw new Error(`获取历史记录失败 (${res.status})`);
  return res.json();
}

// ============================================
// 轮询直到完成
// ============================================

export async function pollTaskUntilDone(
  taskId: string,
  onProgress?: (status: TaskStatusResponse) => void,
  maxPendingAttempts = 60,
  intervalMs = 5000,
): Promise<TaskStatusResponse> {
  let pendingCount = 0;

  for (;;) {
    const result = await getTaskStatus(taskId);
    onProgress?.(result);

    if (result.output.task_status === "Success") {
      return result;
    }

    if (result.output.task_status === "Failure") {
      throw new Error(
        result.output.error_message ?? "音乐生成失败，请重试",
      );
    }

    if (result.output.task_status === "Pending") {
      pendingCount++;
      if (pendingCount >= maxPendingAttempts) {
        throw new Error("任务排队超时，请稍后在历史记录中查看");
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
