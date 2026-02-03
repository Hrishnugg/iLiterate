/**
 * Environment variable validation and configuration
 * This module provides safe access to environment variables with validation.
 */

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please check your .env.local file or environment configuration.`
    );
  }
  return value;
}

// Lazy environment configuration - validates on first access
let _env: {
  supabase: {
    url: string;
    anonKey: string;
  };
} | null = null;

export function getEnv() {
  if (_env === null) {
    _env = {
      supabase: {
        url: getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
        anonKey: getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      },
    };
  }
  return _env;
}

// Export a proxy object that validates on first access
export const env = {
  get supabase() {
    return getEnv().supabase;
  },
};

// Type for the environment configuration
export type EnvConfig = ReturnType<typeof getEnv>;
