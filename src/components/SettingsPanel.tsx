import { useState, useEffect } from "react";
import { authFetch } from "@/services/auth";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 打开时获取当前脱敏 key
  useEffect(() => {
    if (!open) return;
    setNewKey("");
    setMessage(null);
    setLoading(true);
    authFetch("/api/v1/config/api-key")
      .then((r) => r.json())
      .then((d) => {
        setMaskedKey(d.maskedKey ?? null);
      })
      .catch(() => setMaskedKey(null))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    const key = newKey.trim();
    if (!key) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/v1/config/api-key", {
        method: "PUT",
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "保存失败" });
        return;
      }
      setMessage({ type: "ok", text: "已保存" });
      setNewKey("");
      // 刷新脱敏显示
      const r2 = await authFetch("/api/v1/config/api-key");
      const d2 = await r2.json();
      setMaskedKey(d2.maskedKey ?? null);
    } catch {
      setMessage({ type: "err", text: "网络错误" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setMessage(null);
    try {
      await authFetch("/api/v1/config/api-key", { method: "DELETE" });
      setMaskedKey(null);
      setMessage({ type: "ok", text: "已删除" });
    } catch {
      setMessage({ type: "err", text: "删除失败" });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-surface-light border border-border rounded-2xl p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-6">API 设置</h3>

        {/* 当前状态 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">当前 API Key</label>
          {loading ? (
            <p className="text-sm text-text-secondary">加载中...</p>
          ) : maskedKey ? (
            <div className="flex items-center gap-2">
              <code className="text-sm text-accent-green bg-surface px-3 py-1.5 rounded-lg border border-border flex-1">
                {maskedKey}
              </code>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 text-xs text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
              >
                删除
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-secondary/60">未配置</p>
          )}
        </div>

        {/* 新 Key 输入 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            {maskedKey ? "更换 API Key" : "设置 API Key"}
          </label>
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="输入你的 UCloud ModelVerse API Key"
            className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <p className="text-[11px] text-text-secondary/60 mt-1.5">
            从{" "}
            <a
              href="https://console.ucloud.cn/modelverse/experience/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-light underline"
            >
              ModelVerse 控制台
            </a>{" "}
            获取
          </p>
        </div>

        {/* Message */}
        {message && (
          <p
            className={`text-xs mb-4 ${message.type === "ok" ? "text-accent-green" : "text-red-400"}`}
          >
            {message.text}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-text-secondary bg-surface border border-border rounded-xl hover:text-text transition-colors"
          >
            关闭
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !newKey.trim()}
            className="flex-1 py-2.5 text-sm text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
