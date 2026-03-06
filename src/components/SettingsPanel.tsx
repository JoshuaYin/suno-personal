import { useState, useEffect } from "react";
import { getApiKey, setApiKey } from "@/services/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [apiKey, setKey] = useState("");

  useEffect(() => {
    if (open) {
      setKey(getApiKey());
    }
  }, [open]);

  function handleSave() {
    setApiKey(apiKey.trim());
    onClose();
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

        {/* API Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setKey(e.target.value)}
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-text-secondary bg-surface border border-border rounded-xl hover:text-text transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 text-sm text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
