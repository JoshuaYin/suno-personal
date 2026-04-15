import { useState, useCallback } from "react";
import type {
  MVAspectRatio,
  MVResolution,
  MVLanguage,
  MVSubmitBody,
  MVTaskRecord,
} from "@/types";
import {
  submitTask,
  pollTaskUntilDone,
} from "@/services/api";
import { addMVTask, updateMVTask } from "@/services/store";

const ASPECT_RATIOS: { value: MVAspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
];

const RESOLUTIONS: { value: MVResolution; label: string }[] = [
  { value: "540p", label: "540p" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

const LANGUAGES: { value: MVLanguage; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

/** 单次生成的结果 */
interface MVResult {
  taskId: string;
  title: string;
  urls: string[];
  status: "pending" | "done" | "error";
  error?: string;
}

export default function MVPage() {
  // 表单 state
  const [imageUrls, setImageUrls] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<MVAspectRatio>("16:9");
  const [resolution, setResolution] = useState<MVResolution>("720p");
  const [addSubtitle, setAddSubtitle] = useState(false);
  const [language, setLanguage] = useState<MVLanguage>("zh");
  const [srtUrl, setSrtUrl] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  // 当前会话的所有生成结果（右侧面板）
  const [results, setResults] = useState<MVResult[]>([]);

  const updateResult = useCallback(
    (taskId: string, patch: Partial<MVResult>) => {
      setResults((prev) =>
        prev.map((r) => (r.taskId === taskId ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  async function handleGenerate() {
    // 解析图片 URL 列表
    const images = imageUrls
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (images.length === 0) {
      setError("请输入至少 1 张图片 URL");
      return;
    }
    if (images.length > 7) {
      setError("最多支持 7 张图片");
      return;
    }

    if (!audioUrl.trim()) {
      setError("请输入音频 URL");
      return;
    }

    setError("");
    setIsGenerating(true);
    setStatusText("提交任务中...");

    try {
      const body: MVSubmitBody = {
        model: "vidu-mv",
        input: {
          images,
          audio_url: audioUrl.trim(),
          ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
        },
        parameters: {
          vidu_type: "one-click/mv",
          aspect_ratio: aspectRatio,
          resolution,
          add_subtitle: addSubtitle,
          language,
          ...(srtUrl.trim() ? { srt_url: srtUrl.trim() } : {}),
        },
      };

      // 提交
      const submitRes = await submitTask(body);
      const taskId = submitRes.output.task_id;

      const title = prompt.trim().slice(0, 30) || "MV 生成";

      // 保存到本地历史记录
      const record: MVTaskRecord = {
        taskId,
        status: "Pending",
        title,
        prompt: prompt.trim(),
        imageCount: images.length,
        urls: [],
        submitTime: Date.now(),
      };
      addMVTask(record);

      // 添加到右侧结果面板
      const newResult: MVResult = {
        taskId,
        title,
        urls: [],
        status: "pending",
      };
      setResults((prev) => [newResult, ...prev]);

      setStatusText("任务已提交，生成中...");

      // 轮询
      const finalResult = await pollTaskUntilDone(taskId, (res) => {
        const s = res.output.task_status;
        if (s === "Running") {
          setStatusText("AI 正在生成你的 MV...");
        }
        updateMVTask(taskId, {
          status: s,
          urls: res.output.urls ?? [],
          finishTime: res.output.finish_time,
          errorMessage: res.output.error_message,
        });
        if (res.output.urls && res.output.urls.length > 0) {
          updateResult(taskId, { urls: res.output.urls });
        }
      });

      const urls = finalResult.output.urls ?? [];
      updateResult(taskId, { urls, status: "done" });
      setStatusText("");

      updateMVTask(taskId, {
        status: "Success",
        urls,
        finishTime: finalResult.output.finish_time,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      setError(msg);
      setStatusText("");
      setResults((prev) => {
        if (prev.length === 0) return prev;
        const [first, ...rest] = prev;
        if (first && first.status === "pending") {
          return [{ ...first, status: "error" as const, error: msg }, ...rest];
        }
        return prev;
      });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* ===== 左侧：输入区 ===== */}
      <div className="w-[420px] shrink-0 border-r border-border overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">生成 MV</h2>
          <p className="text-text-secondary text-sm mt-1">
            上传图片和音频，AI 为你一键生成音乐视频
          </p>
        </div>

        <div className="space-y-5">
          {/* 图片 URL */}
          <div>
            <label className="block text-sm font-medium mb-2">
              图片 URL
              <span className="text-text-secondary/50 font-normal ml-1">
                (每行一个，1~7 张)
              </span>
            </label>
            <textarea
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
              rows={4}
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/50 resize-none transition-colors font-mono disabled:opacity-50"
            />
            <p className="text-[11px] text-text-secondary/50 mt-1">
              支持 png、jpeg、jpg、webp 格式，单张不超过 50MB
            </p>
          </div>

          {/* 音频 URL */}
          <div>
            <label className="block text-sm font-medium mb-2">音频 URL</label>
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/music.mp3"
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
            />
            <p className="text-[11px] text-text-secondary/50 mt-1">
              支持 mp3、wav、aac、m4a 格式，10~180 秒
            </p>
          </div>

          {/* 提示词 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              提示词
              <span className="text-text-secondary/50 font-normal ml-1">
                (可选)
              </span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的 MV 风格和内容..."
              rows={3}
              maxLength={3000}
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/50 resize-none transition-colors disabled:opacity-50"
            />
            <p className="text-[11px] text-text-secondary/50 mt-1 text-right">
              {prompt.length}/3000
            </p>
          </div>

          {/* 画面比例 */}
          <div>
            <label className="block text-sm font-medium mb-2">画面比例</label>
            <div className="grid grid-cols-5 gap-2">
              {ASPECT_RATIOS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAspectRatio(opt.value)}
                  disabled={isGenerating}
                  className={`py-2 text-sm rounded-lg border transition-all ${
                    aspectRatio === opt.value
                      ? "bg-primary/15 text-primary-light border-primary/30"
                      : "bg-surface-light border-border text-text-secondary hover:text-text"
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div>
            <label className="block text-sm font-medium mb-2">分辨率</label>
            <div className="grid grid-cols-3 gap-2">
              {RESOLUTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value)}
                  disabled={isGenerating}
                  className={`py-2 text-sm rounded-lg border transition-all ${
                    resolution === opt.value
                      ? "bg-primary/15 text-primary-light border-primary/30"
                      : "bg-surface-light border-border text-text-secondary hover:text-text"
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 字幕设置 */}
          <div>
            <Checkbox
              checked={addSubtitle}
              onChange={setAddSubtitle}
              disabled={isGenerating}
              label="添加字幕"
            />
          </div>

          {addSubtitle && (
            <div className="space-y-4 pl-8">
              {/* 语言 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  音频语言
                </label>
                <div className="flex gap-2">
                  {LANGUAGES.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLanguage(opt.value)}
                      disabled={isGenerating}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                        language === opt.value
                          ? "bg-primary/15 text-primary-light border-primary/30"
                          : "bg-surface-light border-border text-text-secondary hover:text-text"
                      } disabled:opacity-50`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SRT URL */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  字幕文件 URL
                  <span className="text-text-secondary/50 font-normal ml-1">
                    (可选)
                  </span>
                </label>
                <input
                  type="text"
                  value={srtUrl}
                  onChange={(e) => setSrtUrl(e.target.value)}
                  placeholder="https://example.com/subtitle.srt"
                  disabled={isGenerating}
                  className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Status */}
        {statusText && !error && (
          <div className="mt-5 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary-light flex items-center gap-2">
            {isGenerating && <Spinner />}
            {statusText}
          </div>
        )}

        {/* 生成按钮 */}
        <div className="mt-6">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3.5 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                生成中...
              </span>
            ) : (
              "🎬 开始生成 MV"
            )}
          </button>
        </div>
      </div>

      {/* ===== 右侧：生成结果 ===== */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">生成结果</h3>
            <p className="text-text-secondary text-xs mt-0.5">
              本次会话的所有 MV
            </p>
          </div>
          {results.length > 0 && (
            <button
              onClick={() => setResults([])}
              className="px-3 py-1.5 text-xs text-text-secondary bg-surface-light border border-border rounded-lg hover:text-text transition-colors"
            >
              清空
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100%-80px)] text-center">
            <p className="text-4xl mb-3 opacity-40">🎬</p>
            <p className="text-sm text-text-secondary/60">
              生成的 MV 将在这里展示
            </p>
            <p className="text-xs text-text-secondary/40 mt-1">
              在左侧输入参数后点击「开始生成 MV」
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((r) => (
              <div
                key={r.taskId}
                className="p-4 bg-surface-light border border-border rounded-xl"
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-medium truncate flex-1">
                    {r.title}
                  </h4>
                  {r.status === "pending" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-orange/15 text-accent-orange shrink-0 flex items-center gap-1">
                      <Spinner size={10} />
                      生成中
                    </span>
                  )}
                  {r.status === "done" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-green/15 text-accent-green shrink-0">
                      已完成
                    </span>
                  )}
                  {r.status === "error" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 shrink-0">
                      失败
                    </span>
                  )}
                </div>

                {/* Error */}
                {r.status === "error" && r.error && (
                  <p className="text-xs text-red-400/80 mb-3">{r.error}</p>
                )}

                {/* Loading */}
                {r.status === "pending" && r.urls.length === 0 && (
                  <div className="flex items-center gap-2 py-6 justify-center">
                    <Spinner />
                    <span className="text-xs text-text-secondary">
                      AI 正在生成 MV...
                    </span>
                  </div>
                )}

                {/* Video */}
                {r.urls.length > 0 && (
                  <div className="space-y-3">
                    {r.urls.map((url, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">
                            Video {i + 1}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary-light hover:underline"
                          >
                            下载 MP4
                          </a>
                        </div>
                        <video
                          controls
                          className="w-full rounded-lg"
                          src={url}
                        >
                          <track kind="captions" />
                        </video>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 子组件
// ============================================

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin shrink-0"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 cursor-pointer group ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
          disabled={disabled}
        />
        <div className="w-5 h-5 rounded-md border-2 border-border bg-surface-light peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
          {checked && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
        {label}
      </span>
    </label>
  );
}
