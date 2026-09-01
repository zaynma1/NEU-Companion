import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_ENVIRONMENTS = ['local', 'dev', 'staging'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export type AppRuntimeConfig = {
  appEnv: AppEnvironment;
  apiBaseUrl: string;
  apiTimeoutMs: number;
};

const getLocalFallbackApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }

  return 'http://127.0.0.1:3000/api';
};

const fallbackConfig: AppRuntimeConfig = {
  appEnv: 'local',
  apiBaseUrl: getLocalFallbackApiBaseUrl(),
  apiTimeoutMs: 15000,
};

const extraConfig = (Constants.expoConfig?.extra?.env ?? {}) as Partial<AppRuntimeConfig>;

export const environment: AppRuntimeConfig = {
  appEnv: (extraConfig.appEnv ?? fallbackConfig.appEnv) as AppEnvironment,
  apiBaseUrl: extraConfig.apiBaseUrl ?? fallbackConfig.apiBaseUrl,
  apiTimeoutMs: Number(extraConfig.apiTimeoutMs ?? fallbackConfig.apiTimeoutMs),
};

export function buildApiUrl(path: string): string {
  const normalizedBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export const isLocalEnvironment = environment.appEnv === 'local';
export const isDevEnvironment = environment.appEnv === 'dev';
export const isStagingEnvironment = environment.appEnv === 'staging';
