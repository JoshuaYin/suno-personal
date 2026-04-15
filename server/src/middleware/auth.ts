import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.js";
import type { JwtPayload } from "../services/auth.js";

/**
 * 扩展 Express Request，附加当前登录用户信息
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT 鉴权中间件
 * 从 Authorization: Bearer <token> 中提取并验证 JWT
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "未登录" });
    return;
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "登录已过期，请重新登录" });
    return;
  }

  req.user = payload;
  next();
}
