import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import CreatePage from "./pages/CreatePage";
import HistoryPage from "./pages/HistoryPage";
import MVPage from "./pages/MVPage";
import LoginPage from "./pages/LoginPage";
import { isLoggedIn, clearTokens, tryRefresh } from "./services/auth";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = checking

  // 启动时检查登录状态
  useEffect(() => {
    async function check() {
      if (!isLoggedIn()) {
        setAuthed(false);
        return;
      }
      // 验证 token 是否还有效（尝试 /auth/me）
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        });
        if (res.ok) {
          setAuthed(true);
        } else {
          // access token 过期，尝试 refresh
          const ok = await tryRefresh();
          setAuthed(ok);
          if (!ok) clearTokens();
        }
      } catch {
        setAuthed(false);
      }
    }
    check();
  }, []);

  // 初始化中 — 简短 loading
  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-text-secondary text-sm">加载中...</div>
      </div>
    );
  }

  // 未登录
  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  // 已登录
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/create" element={<CreatePage />} />
        <Route path="/mv" element={<MVPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Route>
    </Routes>
  );
}
