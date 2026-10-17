import { createServer as createHttpServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { resolvePublicHttpsUrl } from './security.mjs';

const execFileAsync = promisify(execFile);
const PDF_LIMIT = 15 * 1024 * 1024;
const IMAGE_LIMIT = 3 * 1024 * 1024;
const MAX_PAGES = 12;
const MAX_SITE_REQUESTS = 80;
const MAX_SITE_BYTES = 30 * 1024 * 1024;
const MAX_RESOURCE_BYTES = 1024 * 1024;
const IMAGE_FORMATS = new Map([['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]);
const IMAGE_INPUT_LIMIT = 8 * 1024 * 1024;
const FORMANT_SYMBOL = readFileSync(new URL('./assets/formant-symbol.svg', import.meta.url));

function authorized(request, expected) {
  const value = request.headers.authorization || '';
  const actual = Buffer.from(value.replace(/^Bearer\s+/i, ''));
  const secret = Buffer.from(expected || '');
  return secret.length > 0 && actual.length === secret.length && timingSafeEqual(actual, secret);
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  response.end(JSON.stringify(body));
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Request body exceeds the renderer size limit.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

function publicResponseHeaders(response) {
  const headers = {};
  for (const key of ['content-type', 'content-encoding', 'content-language']) {
    if (response.headers[key]) headers[key] = response.headers[key];
  }
  return headers;
}

async function requestPublicResource(input, method = 'GET', redirectCount = 0) {
  if (redirectCount > 5) throw new Error('Website redirected too many times.');
  const { url, address, family } = await resolvePublicHttpsUrl(input);
  return await new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method,
      servername: url.hostname,
      lookup: (_hostname, options, callback) => options?.all
        ? callback(null, [{ address, family }])
        : callback(null, address, family),
      headers: { 'User-Agent': 'Formant-Showcase-Preview/1.0', Accept: '*/*', 'Accept-Encoding': 'identity' },
      timeout: 8000,
      maxHeaderSize: 16 * 1024,
    }, (response) => {
      const status = response.statusCode || 502;
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.resume();
        return reject(new Error('Compressed website resources are not supported by the safe renderer.'));
      }
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.resume();
        if (!location) return reject(new Error('Website returned an invalid redirect.'));
        let destination;
        try { destination = new URL(location, url).href; } catch { return reject(new Error('Website returned an invalid redirect.')); }
        return requestPublicResource(destination, 'GET', redirectCount + 1).then(resolve, reject);
      }
      if (status < 200 || status >= 400) {
        response.resume();
        return resolve({ status, headers: publicResponseHeaders(response), body: Buffer.alloc(0) });
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESOURCE_BYTES) {
          request.destroy(new Error('Website resource exceeds the renderer limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status, headers: publicResponseHeaders(response), body: Buffer.concat(chunks, size) }));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Website request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

async function logoBadge(size) {
  const mark = await sharp(FORMANT_SYMBOL)
    .resize({ width: Math.round(size * 0.58), height: Math.round(size * 0.58), fit: 'inside' })
    .png().toBuffer({ resolveWithObject: true });
  const backing = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${Math.round(size * 0.24)}" fill="#fff" fill-opacity=".92" stroke="#11120f" stroke-opacity=".12" stroke-width="2"/></svg>`);
  return sharp(backing).composite([{
    input: mark.data,
    left: Math.round((size - mark.info.width) / 2),
    top: Math.round((size - mark.info.height) / 2),
  }]).png().toBuffer();
}

export async function makeWatermarkedWebp(input, expectedContentType = null) {
  const source = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' });
  const metadata = await source.metadata();
  const detectedContentType = IMAGE_FORMATS.get(metadata.format);
  if (!detectedContentType || (expectedContentType && detectedContentType !== expectedContentType)) {
    throw new Error('The uploaded image contents do not match a supported JPEG, PNG, or WebP format.');
  }
  if (!metadata.width || !metadata.height) throw new Error('Image dimensions could not be read.');
  const resized = await source.rotate()
    .resize({ width: 1440, height: 2200, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true });
  const badgeSize = Math.max(20, Math.min(82, Math.round(Math.min(resized.info.width, resized.info.height) * 0.075)));
  const badge = await logoBadge(badgeSize);
  const margin = Math.max(4, Math.round(Math.min(resized.info.width, resized.info.height) * 0.025));
  const output = await sharp(resized.data)
    .composite([{
      input: badge,
      left: Math.max(0, resized.info.width - badgeSize - margin),
      top: Math.max(0, resized.info.height - badgeSize - margin),
    }])
    .webp({ quality: 76, effort: 4 }).toBuffer();
  if (output.length < 16 || output.length > IMAGE_LIMIT) throw new Error('Generated preview exceeds the image size limit.');
  return output;
}

async function watermarkUploadedImage(request, response) {
  const declaredType = String(request.headers['content-type'] || '').toLowerCase().split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(declaredType)) {
    throw new Error('Only JPEG, PNG, and WebP source images are supported.');
  }
  const source = await readBody(request, IMAGE_INPUT_LIMIT);
  if (!source.length) throw new Error('Choose a non-empty source image.');
  const output = await makeWatermarkedWebp(source, declaredType);
  response.writeHead(200, {
    'Content-Type': 'image/webp',
    'Content-Length': output.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(output);
}

export async function renderPdf(request) {
  const source = await readBody(request, PDF_LIMIT);
  if (source.length < 8 || source.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('The uploaded source is not a valid PDF.');
  const directory = await mkdtemp(join(tmpdir(), 'formant-showcase-pdf-'));
  try {
    const inputPath = join(directory, 'source.pdf');
    const prefix = join(directory, 'page');
    await import('node:fs/promises').then(({ writeFile }) => writeFile(inputPath, source, { mode: 0o600 }));
    const { stdout: info } = await execFileAsync('pdfinfo', [inputPath], { timeout: 12000, maxBuffer: 128 * 1024 });
    const pageCount = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('PDF page count could not be read.');
    if (pageCount > MAX_PAGES) throw new Error(`PDF has ${pageCount} pages; the supported preview limit is ${MAX_PAGES}.`);
    await execFileAsync('pdftoppm', ['-f', '1', '-l', String(pageCount), '-scale-to', '1800', '-png', inputPath, prefix], { timeout: 45000, maxBuffer: 512 * 1024 });
    const files = (await readdir(directory)).filter((name) => /^page-\d+\.png$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    if (files.length !== pageCount) throw new Error('PDF conversion did not produce every page preview.');
    const previews = [];
    for (let index = 0; index < files.length; index += 1) {
      const webp = await makeWatermarkedWebp(await readFile(join(directory, files[index])));
      previews.push({ pageNumber: index + 1, dataBase64: webp.toString('base64') });
    }
    return { previews, overview: { title: 'PDF document', description: `${pageCount} page${pageCount === 1 ? '' : 's'} rendered as image previews with the official Formant symbol. Source PDF remains private.` } };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function renderWebsite(request) {
  const body = await readBody(request, 12 * 1024);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch { throw new Error('A valid website URL is required.'); }
  const initial = await resolvePublicHttpsUrl(payload?.url);
  const browser = await chromium.launch({ headless: true, args: ['--disable-webrtc', '--disable-background-networking', '--disable-sync'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, acceptDownloads: false, serviceWorkers: 'block' });
    let requestCount = 0;
    let transferred = 0;
    let reserved = 0;
    let navigationFailure = '';
    await context.routeWebSocket('**/*', (socket) => socket.close({ code: 1008, reason: 'WebSockets are not enabled for preview capture.' }));
    await context.route('**/*', async (route) => {
      const req = route.request();
      try {
        requestCount += 1;
        if (requestCount > MAX_SITE_REQUESTS || !['GET', 'HEAD'].includes(req.method())) throw new Error('Website made too many or unsupported requests.');
        if (transferred + reserved + MAX_RESOURCE_BYTES > MAX_SITE_BYTES) throw new Error('Website exceeded the total network-size limit.');
        reserved += MAX_RESOURCE_BYTES;
        let result;
        try {
          result = await requestPublicResource(req.url(), req.method());
          transferred += result.body.length;
        } finally {
          reserved -= MAX_RESOURCE_BYTES;
        }
        await route.fulfill({ status: result.status, headers: result.headers, body: result.body });
      } catch (error) {
        if (req.isNavigationRequest() && !navigationFailure) navigationFailure = String(error?.message || 'network request blocked').slice(0, 240);
        await route.abort('blockedbyclient').catch(() => {});
      }
    });
    const page = await context.newPage();
    let response;
    try {
      response = await page.goto(initial.url.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch (error) {
      throw new Error(`Website navigation failed: ${navigationFailure || String(error?.message || 'capture network error').slice(0, 240)}`);
    }
    if (!response || !response.ok()) throw new Error(`Website could not be loaded for preview (HTTP ${response?.status() || 'no response'}).`);
    await page.waitForTimeout(1200);
    const overview = await page.evaluate(() => ({
      title: document.title || '',
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    }));
    const raw = await page.screenshot({ type: 'png', fullPage: false, animations: 'disabled', timeout: 10000 });
    const preview = await makeWatermarkedWebp(raw);
    await context.close();
    return { previews: [{ pageNumber: 1, dataBase64: preview.toString('base64') }], overview };
  } finally {
    await browser.close();
  }
}

export function createServer(token = process.env.SHOWCASE_RENDERER_TOKEN || '') {
  return createHttpServer(async (request, response) => {
    if (request.method !== 'POST' || !['/render/pdf', '/render/website', '/watermark/image'].includes(request.url)) return send(response, 404, { error: 'Not found' });
    if (!authorized(request, token)) return send(response, 401, { error: 'Unauthorized' });
    try {
      if (request.url === '/watermark/image') {
        await watermarkUploadedImage(request, response);
        return;
      }
      const result = request.url === '/render/pdf' ? await renderPdf(request) : await renderWebsite(request);
      return send(response, 200, result);
    } catch (error) {
      return send(response, 400, { error: String(error?.message || 'Rendering failed.').slice(0, 500) });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const token = process.env.SHOWCASE_RENDERER_TOKEN || '';
  if (token.length < 32) throw new Error('SHOWCASE_RENDERER_TOKEN must be at least 32 characters.');
  const port = Number(process.env.PORT || 8080);
  createServer(token).listen(port, '0.0.0.0', () => console.log(`Showcase renderer listening on ${port}`));
}
