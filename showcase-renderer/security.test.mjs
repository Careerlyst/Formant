import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, resolvePublicHttpsUrl } from './security.mjs';

test('rejects loopback, private, link-local and mapped private addresses', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test('accepts globally routable addresses', () => {
  assert.equal(isPublicAddress('1.1.1.1'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('requires HTTPS, rejects URL credentials and non-standard ports', async () => {
  await assert.rejects(resolvePublicHttpsUrl('http://example.com', { lookup: async () => [{ address: '1.1.1.1', family: 4 }] }));
  await assert.rejects(resolvePublicHttpsUrl('https://user:pass@example.com', { lookup: async () => [{ address: '1.1.1.1', family: 4 }] }));
  await assert.rejects(resolvePublicHttpsUrl('https://example.com:8443', { lookup: async () => [{ address: '1.1.1.1', family: 4 }] }));
});

test('rejects a host if any resolved address is not public', async () => {
  const resolver = { lookup: async () => [{ address: '1.1.1.1', family: 4 }, { address: '10.0.0.4', family: 4 }] };
  await assert.rejects(resolvePublicHttpsUrl('https://rebind.example', resolver), /restricted|non-public/i);
});

test('returns a pinned public DNS result for an HTTPS URL', async () => {
  const resolver = { lookup: async (host) => host === 'example.com' ? [{ address: '1.1.1.1', family: 4 }] : [] };
  const result = await resolvePublicHttpsUrl('https://example.com/portfolio', resolver);
  assert.equal(result.url.hostname, 'example.com');
  assert.equal(result.address, '1.1.1.1');
});
