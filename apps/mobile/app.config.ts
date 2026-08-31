import type { ExpoConfig } from 'expo/config';

const appEnv = (process.env.APP_ENV ?? 'local') as 'local' | 'dev' | 'staging';

const envByName = {
  local: {
    appEnv: 'local',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api',
    apiTimeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),
  },
  dev: {
    appEnv: 'dev',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api-dev.neu-companion.example/api',
    apiTimeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),
  },
  staging: {
    appEnv: 'staging',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api-staging.neu-companion.example/api',
    apiTimeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),
  },
} as const;

const runtimeEnv = envByName[appEnv] ?? envByName.local;

const config: ExpoConfig = {
  name:
    appEnv === 'staging'
      ? 'NEU Companion (Staging)'
      : appEnv === 'dev'
        ? 'NEU Companion (Dev)'
        : 'NEU Companion',
  slug: 'mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    env: runtimeEnv,
  },
};

export default config;
