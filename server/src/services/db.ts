import mysql from "mysql2/promise";
import { dbConfig } from "../config.js";

let pool: mysql.Pool | null = null;

/**
 * 获取连接池（懒初始化，单例）
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // 超时配置
      connectTimeout: 10_000,
      // 空闲回收
      idleTimeout: 60_000,
    });
    console.log(
      `[db] 连接池已创建 → ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
    );
  }
  return pool;
}

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.ping();
    console.log("[db] 连接测试通过 ✓");
  } finally {
    conn.release();
  }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[db] 连接池已关闭");
  }
}
