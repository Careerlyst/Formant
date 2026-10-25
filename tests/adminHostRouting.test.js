import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_HOSTNAME, getHostRootDestination } from '../src/lib/adminHostRouting.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('dedicated admin hostname routing', () => {
  it('routes only the admin hostname root to the existing protected admin entry', () => {
    assert.equal(getHostRootDestination(ADMIN_HOSTNAME), '/admin');
    assert.equal(getHostRootDestination(ADMIN_HOSTNAME.toUpperCase()), '/admin');
  });

  it('keeps the public root and non-root paths unchanged on every hostname', () => {
    assert.equal(getHostRootDestination('www.formant.cv'), '/');
    assert.equal(getHostRootDestination('careerlyst-three.vercel.app'), '/');
    assert.equal(getHostRootDestination(ADMIN_HOSTNAME, '/admin/settings'), '/admin/settings');
    assert.equal(getHostRootDestination(ADMIN_HOSTNAME, '/services'), '/services');
  });

  it('keeps the root route under the existing React Router authorization boundary', () => {
    const source = fs.readFileSync(path.join(rootDir, 'src/main.jsx'), 'utf8');
    const adminRoute = source.match(/<Route\s+path="\/admin"\s+element=\{([\s\S]*?)\}\s*\/>/);
    assert.ok(adminRoute, 'the existing /admin route must remain registered');
    assert.match(adminRoute[1], /<AdminProtected>/);
    assert.match(source, /<Route\s+path="\/"\s+element=\{<HomeRoute \/>\}\s*\/>/);
    assert.match(source, /<Navigate to=\{\{ pathname: destination, search: location\.search, hash: location\.hash \}\} replace \/>/);
  });
});
