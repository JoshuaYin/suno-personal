import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "./db.js";
import { jwtConfig } from "../config.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ---- Types ----

export interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  nickname: string | null;
  role: "admin" | "user";
  is_active: number;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ---- Helpers ----

const SALT_ROUNDS = 10;

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.accessExpiresIn as any,
  });
}

function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.refreshExpiresIn as any,
  });
}

// ---- Public API ----

/**
 * 注册新用户
 */
export async function register(
  username: string,
  password: string,
  nickname?: string,
): Promise<{ userId: number }> {
  const pool = getPool();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)`,
    [username, hash, nickname ?? null],
  );

  return { userId: result.insertId };
}

/**
 * 登录：验证用户名密码，返回 token 对
 */
export async function login(
  username: string,
  password: string,
): Promise<TokenPair | null> {
  const pool = getPool();

  const [rows] = await pool.execute<UserRow[]>(
    `SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1`,
    [username],
  );

  if (rows.length === 0) return null;

  const user = rows[0]!;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  // 更新最后登录时间
  await pool
    .execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id])
    .catch(() => {});

  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/**
 * 验证 access token，返回 payload
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, jwtConfig.secret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 用 refresh token 换新 token 对
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<TokenPair | null> {
  const payload = verifyToken(refreshToken);
  if (!payload) return null;

  // 确认用户仍然存在且活跃
  const pool = getPool();
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT id, username, role FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
    [payload.userId],
  );

  if (rows.length === 0) return null;

  const user = rows[0]!;
  const newPayload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return {
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload),
  };
}
