import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SEO_PAGES, SITE_ORIGIN, BRAND_IMAGE } from './src/lib/seo.js'

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function replaceMeta(html, id, property, value) {
  const escaped = escapeAttribute(value);
  const pattern = new RegExp(`<meta id="${id}"[^>]*>`);
  return html.replace(pattern, `<meta id="${id}" ${property}="${escaped}"/>`);
}

function staticSeoPages() {
  return {
    name: 'formant-static-seo-pages',
    apply: 'build',
    writeBundle(outputOptions) {
      const outputDirectory = resolve(outputOptions.dir || 'dist');
      const template = readFileSync(resolve(outputDirectory, 'index.html'), 'utf8');
      for (const [path, metadata] of Object.entries(SEO_PAGES)) {
        if (path === '/') continue;

        let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(metadata.title)}</title>`);
        html = replaceMeta(html, 'seo-description', 'name="description" content', metadata.description);
        html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="index,follow"/>');
        html = html.replace(/<link id="seo-canonical"[^>]*>/, `<link id="seo-canonical" rel="canonical" href="${SITE_ORIGIN}${path}"/>`);
        html = replaceMeta(html, 'seo-og-title', 'property="og:title" content', metadata.title);
        html = replaceMeta(html, 'seo-og-description', 'property="og:description" content', metadata.description);
        html = replaceMeta(html, 'seo-og-url', 'property="og:url" content', `${SITE_ORIGIN}${path}`);
        html = replaceMeta(html, 'seo-og-image', 'property="og:image" content', BRAND_IMAGE);
        html = replaceMeta(html, 'seo-og-image-alt', 'property="og:image:alt" content', 'Formant career preparation');
        html = replaceMeta(html, 'seo-twitter-title', 'name="twitter:title" content', metadata.title);
        html = replaceMeta(html, 'seo-twitter-description', 'name="twitter:description" content', metadata.description);
        html = replaceMeta(html, 'seo-twitter-image', 'name="twitter:image" content', BRAND_IMAGE);

        const fileName = `seo/${path.slice(1).replaceAll('/', '-')}.html`;
        const target = resolve(outputDirectory, fileName);
        mkdirSync(resolve(target, '..'), { recursive: true });
        writeFileSync(target, html);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), staticSeoPages()],

  server: {
    allowedHosts: [
      '.trycloudflare.com',
    ],
  },
})
