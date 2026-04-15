import { Router } from "express";
import type { Request, Response } from "express";
import {
  setUserConfig,
  getUserConfigMasked,
  deleteUserConfig,
} from "../services/user-config.js";

const router = Router();

// ============================================
// GET /api/v1/config/api-key  — 获取脱敏的 API Key
// ============================================
router.get("/v1/config/api-key", async (req: Request, res: Response) => {
  try {
    const masked = await getUserConfigMasked(req.user!.userId, "api_key");
    res.json({
      configured: !!masked,
      maskedKey: masked,
    });
  } catch (err) {
    console.error("[config] get api-key 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// PUT /api/v1/config/api-key  — 设置 API Key
// ============================================
router.put("/v1/config/api-key", async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      res.status(400).json({ error: "apiKey 不能为空" });
      return;
    }

    await setUserConfig(req.user!.userId, "api_key", apiKey.trim());

    res.json({ message: "API Key 已保存" });
  } catch (err) {
    console.error("[config] set api-key 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// ============================================
// DELETE /api/v1/config/api-key  — 删除 API Key
// ============================================
router.delete("/v1/config/api-key", async (req: Request, res: Response) => {
  try {
    const deleted = await deleteUserConfig(req.user!.userId, "api_key");
    res.json({
      message: deleted ? "API Key 已删除" : "未配置 API Key",
    });
  } catch (err) {
    console.error("[config] delete api-key 错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

export default router;
