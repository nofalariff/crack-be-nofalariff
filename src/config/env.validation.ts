import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),

  PORT: Joi.number().port().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().required(),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_PATH: Joi.string().default('./uploads'),
  STORAGE_BUCKET: Joi.string().optional(),
  STORAGE_ENDPOINT: Joi.string().optional(),
  STORAGE_KEY: Joi.string().optional(),
  STORAGE_SECRET: Joi.string().optional(),
  MAX_UPLOAD_SIZE_MB: Joi.number().positive().default(5),

  BANK_NAME: Joi.string().required(),
  BANK_ACCOUNT_NUMBER: Joi.string().required(),
  BANK_ACCOUNT_HOLDER: Joi.string().required(),

  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),

  SWAGGER_ENABLED: Joi.boolean().default(true),

  // Batas rate limit per menit per IP (planbackend.md §8.3). Nilai bawaannya
  // untuk production; longgarkan saat menjalankan E2E frontend yang paralel.
  RATE_LIMIT_LOGIN: Joi.number().positive().default(5),
  RATE_LIMIT_REGISTER: Joi.number().positive().default(3),
  RATE_LIMIT_RATE_CALCULATOR: Joi.number().positive().default(30),
  RATE_LIMIT_DEFAULT: Joi.number().positive().default(100),
});
