import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import SettingsPanel from "./SettingsPanel";

const navItems = [
  { to: "/create", label: "创作", icon: "🎵" },
  { to: "/mv", label: "生成 MV", icon: "🎬" },
  { to: "/history", label: "历史", icon: "📋" },
];

export default function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-surface-light border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-primary-light">Suno</span>{" "}
            <span className="text-text-secondary text-sm font-normal">Music</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">AI 音乐创作平台</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary-light"
                    : "text-text-secondary hover:text-text hover:bg-surface-lighter"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text hover:bg-surface-lighter transition-colors"
          >
            <span className="text-lg">⚙️</span>
            API 设置
          </button>
        </div>
        <div className="px-5 py-4 border-t border-border">
          <p className="text-xs text-text-secondary">Private Deployment</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Settings Modal */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
