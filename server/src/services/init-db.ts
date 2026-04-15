import { getPool } from "./db.js";

/**
 * 初始化数据库表结构
 */
export async function initTables(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      username      VARCHAR(64)     NOT NULL,
      password_hash VARCHAR(255)    NOT NULL COMMENT 'bcrypt hash',
      nickname      VARCHAR(64)     DEFAULT NULL,
      role          ENUM('admin','user') NOT NULL DEFAULT 'user',
      is_active     TINYINT(1)      NOT NULL DEFAULT 1,
      created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login_at DATETIME        DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("[db] users 表就绪 ✓");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_config (
      id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      user_id     INT UNSIGNED  NOT NULL,
      config_key  VARCHAR(64)   NOT NULL,
      config_val  TEXT          NOT NULL COMMENT 'AES-256-GCM 加密后的值',
      created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_user_key (user_id, config_key),
      CONSTRAINT fk_user_config_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("[db] user_config 表就绪 ✓");
}
