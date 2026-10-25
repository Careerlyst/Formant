import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_HOSTNAME, getHostRouteDestination, isAdminHostname } from '../src/lib/adminHostRouting.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('dedicated admin hostname routing', () => {
  it('routes only the admin hostname root to the existing protected admin entry', () => {
    assert.equal(getHostRouteDestination(ADMIN_HOSTNAME), '/admin');
    assert.equal(getHostRouteDestination(ADMIN_HOSTNAME.toUpperCase()), '/admin');
    assert.equal(isAdminHostname(ADMIN_HOSTNAME), true);
    assert.equal(isAdminHostname('www.formant.cv'), false);
  });

  it('sends client-only paths to /admin only on the dedicated admin hostname', () => {
    for (const path of ['/dashboard', '/dashboard/profile', '/dashboard/messages', '/dashboard/settings', '/assessment', '/service-selection', '/onboarding/avatar']) {
      assert.equal(getHostRouteDestination(ADMIN_HOSTNAME, path), '/admin');
      assert.equal(getHostRouteDestination('www.formant.cv', path), path);
      assert.equal(getHostRouteDestination('formant.cv', path), path);
    }
  });

  it('keeps public and existing admin routes unchanged', () => {
    assert.equal(getHostRouteDestination('www.formant.cv'), '/');
    assert.equal(getHostRouteDestination('formant.cv'), '/');
    assert.equal(getHostRouteDestination('careerlyst-three.vercel.app'), '/');
    for (const path of ['/admin', '/admin/workspace', '/admin/users', '/admin/orders', '/admin/projects', '/admin/leads', '/admin/settings']) {
      assert.equal(getHostRouteDestination(ADMIN_HOSTNAME, path), path);
    }
    assert.equal(getHostRouteDestination(ADMIN_HOSTNAME, '/services'), '/services');
  });

  it('keeps the root route under the existing React Router authorization boundary', () => {
    const source = fs.readFileSync(path.join(rootDir, 'src/main.jsx'), 'utf8');
    const adminRoute = source.match(/<Route\s+path="\/admin"\s+element=\{([\s\S]*?)\}\s*\/>/);
    assert.ok(adminRoute, 'the existing /admin route must remain registered');
    assert.match(adminRoute[1], /<AdminProtected>/);
    assert.match(source, /<Route\s+path="\/"\s+element=\{<HomeRoute \/>\}\s*\/>/);
    assert.match(source, /<Navigate to=\{\{ pathname: destination, search: location\.search, hash: location\.hash \}\} replace \/>/);
    assert.match(source, /function AdminHostRoute\(\{ children \}\)/);
    const dashboardRoutes = [...source.matchAll(/<Route\s+path="\/dashboard[^\"]*"\s+element=\{([\s\S]*?)\}\s*\/>/g)];
    assert.equal(dashboardRoutes.length, 9);
    for (const route of dashboardRoutes.slice(0, 8)) assert.match(route[1], /<AdminHostRoute>/);
    assert.match(dashboardRoutes[8][0], /path="\/dashboard\/\*"/);
    assert.match(source, /<AdminHostRoute><Protected requireAvatar=\{false\}>/);
    assert.match(source, /<AdminHostRoute>[\s\S]*<Protected><LeadAssessment \/><\/Protected>/);
    assert.match(source, /<AdminHostRoute>[\s\S]*<Protected><ServiceSelection \/><\/Protected>/);
  });

  it('retains trusted staff checks and avoids a denied-user dashboard loop on the admin host', () => {
    const guard = fs.readFileSync(path.join(rootDir, 'src/components/AdminProtected.jsx'), 'utf8');
    assert.match(guard, /useStaffAccess\(pathname\)/);
    assert.match(guard, /access\.status === 'checking'/);
    assert.match(guard, /access\.status === 'denied'/);
    assert.match(guard, /isAdminHostname\(window\.location\.hostname\)/);
    assert.match(guard, /Admin access required/);
    assert.match(guard, /<Navigate to="\/dashboard" replace \/>/);
    assert.match(guard, /Go to the client dashboard/);
    assert.match(guard, /Go to the client dashboard[\s\S]*|<a href="https:\/\/www\.formant\.cv\/dashboard">/);

    const adminSource = fs.readFileSync(path.join(rootDir, 'src/pages/Admin.jsx'), 'utf8');
    assert.match(adminSource, /<DashboardShell admin>/);
    assert.match(adminSource, /CONTROL PANEL/);
  });
});
