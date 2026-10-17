import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PUBLIC_SEO_PAGES, renderSeoTags } from './src/lib/seo.js'

function seoHtmlSnapshots() {
  return {
    name: 'formant-seo-html-snapshots',
    apply: 'build',
    writeBundle(outputOptions) {
      const outputDirectory = resolve(outputOptions.dir || 'dist')
      const indexPath = resolve(outputDirectory, 'index.html')
      const template = readFileSync(indexPath, 'utf8')

      Object.entries(PUBLIC_SEO_PAGES).forEach(([route, page]) => {
        if (route === '/') return
        const html = template
          .replace(/<title>[\s\S]*?<\/title>/i, '')
          .replace(/<meta\s+name="description"[^>]*\/?\s*>/gi, '')
          .replace(/<meta\s+name="robots"[^>]*\/?\s*>/gi, '')
          .replace(/<link\s+rel="canonical"[^>]*\/?\s*>/gi, '')
          .replace(/<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*\/?\s*>/gi, '')
          .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
          .replace('</head>', `    ${renderSeoTags(page)}\n  </head>`)
        const snapshotPath = resolve(outputDirectory, 'seo', `${route.slice(1)}.html`)
        mkdirSync(dirname(snapshotPath), { recursive: true })
        writeFileSync(snapshotPath, html)
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), seoHtmlSnapshots()],

  server: {
    allowedHosts: [
      '.trycloudflare.com',
    ],
  },
})
