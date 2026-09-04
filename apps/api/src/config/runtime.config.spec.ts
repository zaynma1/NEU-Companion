import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  getAllowedOrigins,
  getDeviceCookieOptions,
  getExpressTrustProxySetting,
  getSessionCookieOptions,
  resolveClientIp,
  resolveCorsOrigin,
  validateRuntimeEnvironment,
} from './runtime.config';

describe('runtime config hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses secure cookies in production and non-secure cookies in development', () => {
    expect(getSessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    expect(getSessionCookieOptions('development')).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
  });

  it('uses an explicit CORS origin allow-list', () => {
    process.env.CORS_ORIGINS = 'https://app.example.edu, https://admin.example.edu';

    expect(getAllowedOrigins()).toEqual(['https://app.example.edu', 'https://admin.example.edu']);
    expect(getAllowedOrigins()).not.toContain('https://evil.example');
    expect(resolveCorsOrigin('https://app.example.edu')).toBe('https://app.example.edu');
    expect(resolveCorsOrigin('https://evil.example')).toBe(false);
    expect(resolveCorsOrigin(undefined)).toBe(true);
  });

  it('fails fast when required production env vars are missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.POSTGRES_HOST;
    delete process.env.DATABASE_URL;

    expect(() => validateRuntimeEnvironment()).toThrow(/Missing required production env vars/i);
  });

  it('audit 1.4 - requires explicit production proxy configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'client';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://app.example.edu/callback';
    process.env.POSTGRES_HOST = 'db';
    process.env.DATABASE_URL = 'postgres://db';
    process.env.CORS_ORIGINS = 'https://app.example.edu';
    process.env.CSRF_SECRET = 'csrf';
    process.env.DEVICE_COOKIE_SECRET = 'device';
    process.env.AUTH_THROTTLE_SECRET = 'throttle';
    delete process.env.TRUST_PROXY_MODE;
    expect(() => validateRuntimeEnvironment()).toThrow(/TRUST_PROXY_MODE/i);

    process.env.TRUST_PROXY_MODE = 'hops';
    delete process.env.TRUST_PROXY_HOPS;
    expect(() => validateRuntimeEnvironment()).toThrow(/TRUST_PROXY_HOPS/i);

    process.env.TRUST_PROXY_MODE = 'allowlist';
    process.env.TRUST_PROXY_ALLOWLIST = 'not-a-cidr';
    expect(() => validateRuntimeEnvironment()).toThrow(/invalid CIDR/i);
  });

  it('audit 1.4 - resolves trusted IPs according to the configured topology', () => {
    process.env.TRUST_PROXY_MODE = 'direct';
    expect(getExpressTrustProxySetting()).toBe(false);
    expect(resolveClientIp({ socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-forwarded-for': '198.51.100.5' } })).toBe(
      '10.0.0.2',
    );

    process.env.TRUST_PROXY_MODE = 'hops';
    process.env.TRUST_PROXY_HOPS = '1';
    expect(resolveClientIp({ socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-forwarded-for': '198.51.100.5' } })).toBe(
      '198.51.100.5',
    );
    expect(resolveClientIp({ socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.5' } })).toBe(
      '10.0.0.2',
    );

    process.env.TRUST_PROXY_MODE = 'allowlist';
    process.env.TRUST_PROXY_ALLOWLIST = '10.0.0.0/8';
    expect(resolveClientIp({ socket: { remoteAddress: '192.0.2.1' }, headers: { 'x-forwarded-for': '198.51.100.5' } })).toBe(
      '192.0.2.1',
    );
    expect(resolveClientIp({ socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-forwarded-for': '198.51.100.5' } })).toBe(
      '198.51.100.5',
    );
  });

  it('audit 1.4 - buckets IPv6 client keys to a /64 and gives the device cookie an independent lifetime', () => {
    process.env.TRUST_PROXY_MODE = 'direct';
    expect(resolveClientIp({ socket: { remoteAddress: '2001:db8:abcd:12:1111:2222:3333:4444' }, headers: {} })).toBe(
      '2001:0db8:abcd:0012:0000:0000:0000:0000',
    );
    expect(resolveClientIp({ socket: { remoteAddress: '2001:db8:abcd:12:aaaa:bbbb:cccc:dddd' }, headers: {} })).toBe(
      '2001:0db8:abcd:0012:0000:0000:0000:0000',
    );
    expect(getDeviceCookieOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      signed: true,
    });
    expect(getDeviceCookieOptions('production').maxAge).toBeGreaterThan(getSessionCookieOptions('production').maxAge);
  });
});
