import "dotenv/config";

export const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "suno_personal",
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET || "change-me-in-production",
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || "3h",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || "7d",
};

export const encryptKey = process.env.ENCRYPT_KEY || "";

export const apiBase = process.env.API_BASE || "https://api.modelverse.cn";
