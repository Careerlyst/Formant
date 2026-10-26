import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

describe('About page image delivery', () => {
  it('uses responsive WebP assets and prioritizes only the hero illustration', () => {
    const source = fs.readFileSync(path.join(rootDir, 'src/pages/PublicPages.jsx'), 'utf8');
    const hero = source.match(/className="about-hero-art-image"([\s\S]*?)\/>/);
    const purpose = source.match(/className="about-purpose-illustration"([\s\S]*?)\/>/);

    assert.ok(hero, 'About hero illustration must exist');
    assert.ok(purpose, 'About purpose illustration must exist');
    assert.match(hero[1], /friendly-team-workspace-800\.webp/);
    assert.match(hero[1], /friendly-team-workspace-480\.webp 480w/);
    assert.match(hero[1], /fetchPriority="high"/);
    assert.match(hero[1], /loading="eager"/);
    assert.match(purpose[1], /confident-professional-portfolio-800\.webp/);
    assert.match(purpose[1], /confident-professional-portfolio-480\.webp 480w/);
    assert.match(purpose[1], /loading="lazy"/);

    for (const asset of [
      'friendly-team-workspace-480.webp',
      'friendly-team-workspace-800.webp',
      'confident-professional-portfolio-480.webp',
      'confident-professional-portfolio-800.webp',
    ]) {
      const bytes = fs.readFileSync(path.join(rootDir, 'public/assets', asset));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${asset} must be a valid WebP file`);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${asset} must be a valid WebP file`);
    }
  });
});
