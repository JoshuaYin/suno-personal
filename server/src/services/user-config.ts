import { getPool } from "./db.js";
import { encrypt, decrypt, maskSecret } from "./crypto.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ConfigRow extends RowDataPacket {
  id: number;
  user_id: number;
  config_key: string;
  config_val: string;
}

/**
 * 设置用户配置（加密存储），存在则更新
 */
export async function setUserConfig(
  userId: number,
  key: string,
  plainValue: string,
): Promise<void> {
  const pool = getPool();
  const encrypted = encrypt(plainValue);

  await pool.execute<ResultSetHeader>(
    `INSERT INTO user_config (user_id, config_key, config_val)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE config_val = VALUES(config_val)`,
    [userId, key, encrypted],
  );
}

/**
 * 获取用户配置（解密后的明文）
 */
export async function getUserConfig(
  userId: number,
  key: string,
): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.execute<ConfigRow[]>(
    `SELECT config_val FROM user_config WHERE user_id = ? AND config_key = ? LIMIT 1`,
    [userId, key],
  );

  if (rows.length === 0) return null;
  return decrypt(rows[0]!.config_val);
}

/**
 * 获取用户配置的脱敏值（用于前端展示）
 */
export async function getUserConfigMasked(
  userId: number,
  key: string,
): Promise<string | null> {
  const plain = await getUserConfig(userId, key);
  if (!plain) return null;
  return maskSecret(plain);
}

/**
 * 删除用户配置
 */
export async function deleteUserConfig(
  userId: number,
  key: string,
): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM user_config WHERE user_id = ? AND config_key = ?`,
    [userId, key],
  );
  return result.affectedRows > 0;
}
