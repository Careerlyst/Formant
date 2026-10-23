import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Sitemap & SEO Configuration', () => {
  it('robots.txt points to https://www.formant.cv/sitemap.xml and disallows private routes', () => {
    const robotsPath = path.join(rootDir, 'public', 'robots.txt');
    const content = fs.readFileSync(robotsPath, 'utf8');

    assert.ok(
      content.includes('Sitemap: https://www.formant.cv/sitemap.xml'),
      'robots.txt must declare https://www.formant.cv/sitemap.xml'
    );
    assert.ok(content.includes('Disallow: /admin'), 'robots.txt must disallow /admin');
    assert.ok(content.includes('Disallow: /dashboard'), 'robots.txt must disallow /dashboard');
    assert.ok(content.includes('Disallow: /assessment'), 'robots.txt must disallow /assessment');
    assert.ok(content.includes('Disallow: /service-selection'), 'robots.txt must disallow /service-selection');
  });

  it('sitemap.xml is valid XML and contains only production https://www.formant.cv URLs', () => {
    const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
    const content = fs.readFileSync(sitemapPath, 'utf8');

    assert.ok(content.startsWith('<?xml'), 'sitemap.xml must start with XML declaration');
    assert.ok(content.includes('<urlset'), 'sitemap.xml must contain <urlset>');

    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    let count = 0;

    while ((match = locRegex.exec(content)) !== null) {
      count++;
      const url = match[1];

      assert.ok(
        url.startsWith('https://www.formant.cv/'),
        `Sitemap URL "${url}" must start with production origin https://www.formant.cv/`
      );

      // Verify no legacy domains exist in sitemap
      assert.ok(
        !url.includes('careerlyst-three.vercel.app'),
        `Sitemap URL "${url}" must not contain old Vercel URL`
      );

      // Verify no sensitive internal routes exist in sitemap
      assert.ok(!url.includes('/admin'), `Sitemap must not expose admin URL: ${url}`);
      assert.ok(!url.includes('/dashboard'), `Sitemap must not expose dashboard URL: ${url}`);
      assert.ok(!url.includes('/login'), `Sitemap must not expose login URL: ${url}`);
      assert.ok(!url.includes('/signup'), `Sitemap must not expose signup URL: ${url}`);
    }

    assert.ok(count >= 10, `Expected at least 10 sitemap URLs, found ${count}`);
  });
});
