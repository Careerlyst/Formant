import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Security Headers (vercel.json)', () => {
  const vercelConfigPath = path.join(rootDir, 'vercel.json');
  assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist');
  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

  it('defines headers configuration', () => {
    assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json must include a headers array');
    assert.ok(vercelConfig.headers.length > 0, 'headers array must not be empty');
  });

  const globalRule = vercelConfig.headers.find((rule) => rule.source === '/(.*)');

  it('has a global /(.*) header rule', () => {
    assert.ok(globalRule, 'A global source /(.*) header rule must be defined');
  });

  const headerMap = new Map();
  if (globalRule?.headers) {
    for (const item of globalRule.headers) {
      headerMap.set(item.key.toLowerCase(), item.value);
    }
  }

  it('sets X-Frame-Options to DENY (anti-clickjacking)', () => {
    assert.equal(headerMap.get('x-frame-options'), 'DENY');
  });

  it('sets X-Content-Type-Options to nosniff (anti-MIME-sniffing)', () => {
    assert.equal(headerMap.get('x-content-type-options'), 'nosniff');
  });

  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    assert.equal(headerMap.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  it('restricts Permissions-Policy for camera, microphone, and geolocation', () => {
    const policy = headerMap.get('permissions-policy') || '';
    assert.ok(policy.includes('camera=()'), 'Permissions-Policy should disable camera');
    assert.ok(policy.includes('microphone=()'), 'Permissions-Policy should disable microphone');
    assert.ok(policy.includes('geolocation=()'), 'Permissions-Policy should disable geolocation');
  });

  it('enforces Content-Security-Policy with frame-ancestors none and origin restrictions', () => {
    const csp = headerMap.get('content-security-policy') || '';
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP must forbid embedding with frame-ancestors none');
    assert.ok(csp.includes("default-src 'self'"), 'CSP must set default-src to self');
    assert.ok(csp.includes("https://*.supabase.co"), 'CSP connect-src must allow Supabase');
    assert.ok(csp.includes("wss://*.supabase.co"), 'CSP connect-src must allow Supabase websockets');
    assert.ok(csp.includes("https://fonts.googleapis.com"), 'CSP style-src must allow Google Fonts');
    assert.ok(csp.includes("https://fonts.gstatic.com"), 'CSP font-src must allow gstatic');
  });

  it('sets noindex, nofollow, noarchive on private routes', () => {
    const privateSources = ['/login', '/signup', '/auth/:path*', '/dashboard', '/admin'];
    for (const src of privateSources) {
      const match = vercelConfig.headers.find((r) => r.source === src);
      assert.ok(match, `Route ${src} should have header configuration`);
      const robotsHeader = match.headers?.find((h) => h.key.toLowerCase() === 'x-robots-tag');
      assert.ok(robotsHeader, `Route ${src} must have X-Robots-Tag`);
      assert.equal(robotsHeader.value, 'noindex, nofollow, noarchive');
    }
  });
});
