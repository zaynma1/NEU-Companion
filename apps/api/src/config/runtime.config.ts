import { createRequire } from 'node:module';
import { isIP } from 'node:net';

export type RuntimeEnvironment = 'development' | 'test' | 'production';
export type TrustProxyMode = 'direct' | 'hops' | 'allowlist';

const proxyaddr = createRequire(`${process.cwd()}/package.json`)('proxy-addr') as {
  compile: (value: string[]) => (address: string, index: number) => boolean;
};

const developmentOrigins = ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

export function getAllowedOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : developmentOrigins;
}

export function getTrustProxyConfig(): {
  mode: TrustProxyMode;
  hops?: number;
  allowlist?: string[];
} {
  const mode = (process.env.TRUST_PROXY_MODE ?? 'direct').trim().toLowerCase();

  if (mode === 'direct') {
    return { mode: 'direct' };
  }

  if (mode === 'hops') {
    const hops = process.env.TRUST_PROXY_HOPS?.trim();
    if (!hops || !/^\d+$/.test(hops) || Number(hops) < 1) {
      throw new Error('TRUST_PROXY_HOPS must be a positive integer when TRUST_PROXY_MODE=hops');
    }

    return { mode: 'hops', hops: Number(hops) };
  }

  if (mode === 'allowlist') {
    const allowlist = process.env.TRUST_PROXY_ALLOWLIST
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!allowlist?.length) {
      throw new Error('TRUST_PROXY_ALLOWLIST must contain at least one CIDR when TRUST_PROXY_MODE=allowlist');
    }

    for (const entry of allowlist) {
      try {
        proxyaddr.compile([entry]);
      } catch {
        throw new Error(`TRUST_PROXY_ALLOWLIST contains an invalid CIDR: ${entry}`);
      }
    }

    return { mode: 'allowlist', allowlist };
  }

  throw new Error('TRUST_PROXY_MODE must be one of: direct, hops, allowlist');
}

export function getExpressTrustProxySetting(config = getTrustProxyConfig()): false | number | string[] {
  if (config.mode === 'direct') {
    return false;
  }

  return config.mode === 'hops' ? config.hops! : config.allowlist!;
}

export function resolveClientIp(req: { socket?: { remoteAddress?: string | null }; headers?: Record<string, unknown> }): string {
  const config = getTrustProxyConfig();
  const socketAddress = req.socket?.remoteAddress ?? 'unknown';

  if (config.mode === 'direct') {
    return bucketClientIp(socketAddress);
  }

  const forwarded = typeof req.headers?.['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for']
    : undefined;
  const forwardedAddresses = forwarded?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  if (config.mode === 'hops' && forwardedAddresses.length > config.hops!) {
    return bucketClientIp(socketAddress);
  }

  const addresses = [socketAddress, ...forwardedAddresses];
  const trust = config.mode === 'hops'
    ? (_address: string, index: number) => index < config.hops!
    : proxyaddr.compile(config.allowlist!);

  for (let index = 0; index < addresses.length; index += 1) {
    if (!trust(addresses[index], index)) {
      return bucketClientIp(addresses[index]);
    }
  }

  return bucketClientIp(addresses[addresses.length - 1]);
}

function bucketClientIp(address: string): string {
  if (isIP(address) !== 6) {
    return address;
  }

  const [host] = address.split('%');
  const groups = host.split('::');
  const left = groups[0] ? groups[0].split(':') : [];
  const right = groups[1] ? groups[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  const expanded = [...left, ...Array(Math.max(missing, 0)).fill('0'), ...right]
    .map((group) => group.padStart(4, '0'));

  return `${expanded.slice(0, 4).join(':')}:0000:0000:0000:0000`;
}

export function resolveCorsOrigin(origin: string | undefined): string | boolean {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin) ? origin : false;
}

export function getSessionCookieOptions(nodeEnv: string | undefined): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
} {
  const environment = (nodeEnv ?? 'development').toLowerCase() as RuntimeEnvironment;
  const isProduction = environment === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
}

export function getDeviceCookieOptions(nodeEnv: string | undefined): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  signed: true;
} {
  const environment = (nodeEnv ?? 'development').toLowerCase() as RuntimeEnvironment;
  return {
    httpOnly: true,
    secure: environment === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
    signed: true,
  };
}

export function validateRuntimeEnvironment(): void {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

  if (nodeEnv !== 'production') {
    getTrustProxyConfig();
    return;
  }

  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'POSTGRES_HOST',
    'DATABASE_URL',
    'CORS_ORIGINS',
    'CSRF_SECRET',
    'TRUST_PROXY_MODE',
    'DEVICE_COOKIE_SECRET',
    'AUTH_THROTTLE_SECRET',
  ] as const;

  const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }

  getTrustProxyConfig();
}
