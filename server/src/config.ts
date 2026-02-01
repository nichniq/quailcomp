import { z } from 'zod';

/**
 * Environment variable schema with validation.
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server configuration
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

  // Authentication
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters for security'
  }),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Optional JWT secret for rotation grace period
  JWT_SECRET_OLD: z.string().min(32).optional(),

  // CORS
  CORS_ORIGINS: z.string().transform(val => val.split(',')).default('http://localhost:5173'),

  // Rate limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Book metadata providers (all optional)
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  OPEN_LIBRARY_API_KEY: z.string().optional(),

  // Analytics
  ANALYTICS_ENABLED: z.coerce.boolean().default(true),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
});

/**
 * Validated environment configuration.
 * Throws on startup if validation fails.
 *
 * In test environment, uses safe defaults to avoid validation errors.
 */
export const env = process.env.NODE_ENV === 'test'
  ? envSchema.parse({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost/quailcomp_test',
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-long-for-testing',
    ...process.env,
  })
  : envSchema.parse(process.env);

/**
 * Type-safe environment variables.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Check if running in production.
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if running in development.
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if running in test.
 */
export const isTest = env.NODE_ENV === 'test';
