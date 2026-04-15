import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDataDirs } from "./services/task-store.js";
import { testConnection } from "./services/db.js";
import { initTables } from "./services/init-db.js";
import authRoutes from "./routes/auth.js";
import sunoRoutes from "./routes/suno.js";
import configRoutes from "./routes/config.js";
import { requireAuth } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 内部端口 3001，外部通过 nginx :8024 反向代理
const PORT = Number(process.env.PORT) || 3001;

const app = express();

// 中间件
app.use(
  cors({
    origin: [
      "http://localhost:8024",
      "http://127.0.0.1:8024",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ],
    credentials: true,
  }),
);
app.use(express.json());

// API 路由
app.use("/api", authRoutes);              // /api/auth/*       无需鉴权
app.use("/api", requireAuth, configRoutes); // /api/v1/config/*  需要登录
app.use("/api", requireAuth, sunoRoutes);   // /api/v1/*         需要登录

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---- 音乐文件静态服务（按用户隔离: /music/:username/file.mp3）----
app.use("/music/:username", (req, res, next) => {
  const username = req.params.username;
  express.static(`/data/suno/${username}/music`)(req, res, next);
});

// ---- 生产模式：serve 前端静态文件 ----
// 前端 build 产物在项目根目录的 dist/（即 server/../dist）
// 从 server/src/index.ts 编译后位于 server/dist/index.js，所以用 ../../dist
const frontendDist = path.resolve(__dirname, "../../dist");
app.use(express.static(frontendDist));

// SPA history fallback：所有非 API 的 GET 请求返回 index.html
// Express 5 使用 path-to-regexp v8+，通配符语法为 {*path}
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// 启动
async function main() {
  await ensureDataDirs();
  await testConnection();
  await initTables();
  app.listen(PORT, () => {
    console.log(`🚀 Suno Personal Server 启动: http://localhost:${PORT}`);
    console.log(`   前端静态文件: ${frontendDist}`);
    console.log(`   模式: ${process.env.NODE_ENV || "development"}`);
  });
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
