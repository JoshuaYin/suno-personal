import crypto from "node:crypto";
import { encryptKey } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 推荐 12 bytes
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  if (!encryptKey || encryptKey.length !== 64) {
    throw new Error("ENCRYPT_KEY 未配置或长度不正确 (需要 64 位 hex)");
  }
  return Buffer.from(encryptKey, "hex");
}

/**
 * AES-256-GCM 加密
 * 返回格式: iv(hex):authTag(hex):ciphertext(hex)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * AES-256-GCM 解密
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("加密数据格式错误");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * 脱敏显示：sk-****xxxx (保留前3后4)
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
