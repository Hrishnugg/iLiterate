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

function getOptionalEnvVar(name: string): string | null {
  const value = process.env[name];
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Lazy environment configuration - validates on first access
let _env: {
  supabase: {
    url: string;
    anonKey: string;
  };
  appUrl: string | null;
  karaoke: {
    encryptionKey: string | null;
    lyrics: {
      serviceUrl: string | null;
      serviceApiKey: string | null;
    };
    appleMusic: {
      developerToken: string | null;
      storefront: string | null;
    };
    soundcloud: {
      clientId: string | null;
      clientSecret: string | null;
    };
    spotify: {
      clientId: string | null;
      clientSecret: string | null;
    };
  };
} | null = null;

export function getEnv() {
  if (_env === null) {
    _env = {
      supabase: {
        url: getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
        anonKey: getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      },
      appUrl: getOptionalEnvVar("NEXT_PUBLIC_APP_URL"),
      karaoke: {
        encryptionKey: getOptionalEnvVar("MUSIC_TOKEN_ENCRYPTION_KEY"),
        lyrics: {
          serviceUrl: getOptionalEnvVar("KARAOKE_LYRICS_SERVICE_URL"),
          serviceApiKey: getOptionalEnvVar("KARAOKE_LYRICS_SERVICE_API_KEY"),
        },
        appleMusic: {
          developerToken: getOptionalEnvVar("APPLE_MUSIC_DEVELOPER_TOKEN"),
          storefront: getOptionalEnvVar("NEXT_PUBLIC_APPLE_MUSIC_STOREFRONT"),
        },
        soundcloud: {
          clientId: getOptionalEnvVar("SOUNDCLOUD_CLIENT_ID"),
          clientSecret: getOptionalEnvVar("SOUNDCLOUD_CLIENT_SECRET"),
        },
        spotify: {
          clientId: getOptionalEnvVar("SPOTIFY_CLIENT_ID"),
          clientSecret: getOptionalEnvVar("SPOTIFY_CLIENT_SECRET"),
        },
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
  get appUrl() {
    return getEnv().appUrl;
  },
  get karaoke() {
    return getEnv().karaoke;
  },
};

// Type for the environment configuration
export type EnvConfig = ReturnType<typeof getEnv>;
