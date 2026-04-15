import { Router } from "express";
import type { Request, Response } from "express";
import { login, register, refreshTokens } from "../services/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ============================================
// POST /api/auth/login
// ============================================
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "用户名和密码不能为空" });
      return;
    }

    const tokens = await login(username, password);
    if (!tokens) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }

    res.json({
      message: "登录成功",
      ...tokens,
    });
  } catch (err) {
    console.error("[auth] login 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// POST /api/auth/refresh
// ============================================
router.post("/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: "缺少 refreshToken" });
      return;
    }

    const tokens = await refreshTokens(refreshToken);
    if (!tokens) {
      res.status(401).json({ error: "refresh token 无效或已过期" });
      return;
    }

    res.json(tokens);
  } catch (err) {
    console.error("[auth] refresh 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// GET /api/auth/me  (需要登录)
// ============================================
router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
  });
});

// ============================================
// POST /api/auth/register (需要 admin 权限)
// ============================================
router.post("/auth/register", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "仅管理员可创建用户" });
      return;
    }

    const { username, password, nickname } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "用户名和密码不能为空" });
      return;
    }

    const { userId } = await register(username, password, nickname);
    res.status(201).json({ message: "用户创建成功", userId });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "用户名已存在" });
      return;
    }
    console.error("[auth] register 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

export default router;
