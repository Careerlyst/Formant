import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAFF_ROLES, isStaffRole } from '../src/lib/roles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Authorization & Admin Routing Gating', () => {
  it('exports valid STAFF_ROLES array', () => {
    assert.ok(Array.isArray(STAFF_ROLES), 'STAFF_ROLES must be an array');
    assert.ok(STAFF_ROLES.includes('admin'), 'STAFF_ROLES must include admin');
    assert.ok(STAFF_ROLES.includes('expert'), 'STAFF_ROLES must include expert');
    assert.ok(STAFF_ROLES.includes('support'), 'STAFF_ROLES must include support');
    assert.ok(STAFF_ROLES.includes('finance'), 'STAFF_ROLES must include finance');
  });

  it('rejects unprivileged client and guest roles from staff access', () => {
    const unprivileged = ['client', 'user', 'guest', 'anonymous', '', null, undefined];
    for (const role of unprivileged) {
      assert.equal(STAFF_ROLES.includes(role), false, `Role "${role}" must not be granted staff privileges`);
    }
  });

  it('ensures all /admin routes in main.jsx are wrapped in <AdminProtected>', () => {
    const mainJsxPath = path.join(rootDir, 'src', 'main.jsx');
    const content = fs.readFileSync(mainJsxPath, 'utf8');

    // Extract all Route definitions for path="/admin..."
    const adminRouteRegex = /<Route\s+path="\/admin([^"]*)"\s+element=\{([\s\S]*?)\}/g;
    let match;
    let count = 0;

    while ((match = adminRouteRegex.exec(content)) !== null) {
      count++;
      const subpath = match[1];
      const elementBody = match[2];

      assert.ok(
        elementBody.includes('<AdminProtected>'),
        `Admin route "/admin${subpath}" must be wrapped in <AdminProtected>`
      );
      assert.ok(
        !elementBody.includes('<Protected>'),
        `Admin route "/admin${subpath}" should not use generic <Protected>`
      );
    }

    assert.ok(count >= 14, `Expected at least 14 protected admin routes, found ${count}`);
  });
});
