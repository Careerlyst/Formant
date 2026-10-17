import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { makeWatermarkedWebp, renderPdf } from './server.mjs';
import sharp from 'sharp';
import test from 'node:test';

test('symbol watermark uses the official mark and contains no text element', async () => {
  const symbol = await readFile(new URL('./assets/formant-symbol.svg', import.meta.url), 'utf8');
  const rendererSource = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
  assert.match(symbol, /fill="#C7F72F"/i);
  assert.match(symbol, /fill="#11120F"/i);
  assert.doesNotMatch(symbol, /<text\b/i);
  assert.doesNotMatch(rendererSource, /FORMANT SHOWCASE\s*·\s*PREVIEW|watermarkSvg|WATERMARK_LABEL/i);

  const input = await sharp({
    create: { width: 800, height: 1100, channels: 3, background: { r: 245, g: 243, b: 235 } },
  }).png().toBuffer();
  const before = Buffer.from(input);
  const output = await makeWatermarkedWebp(input, 'image/png');
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 1100);
  assert.ok(output.length <= 3 * 1024 * 1024);
  assert.deepEqual(input, before, 'the uploaded source buffer must remain unchanged');
});

test('uploaded image processing validates its format and returns a logo-watermarked WebP', async () => {
  const input = await sharp({
    create: { width: 1000, height: 1400, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const output = await makeWatermarkedWebp(input, 'image/png');
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1000);
  assert.equal(metadata.height, 1400);
  assert.ok(output.length <= 3 * 1024 * 1024);
  const corner = await sharp(output)
    .extract({ left: 880, top: 1280, width: 120, height: 120 })
    .removeAlpha().raw().toBuffer();
  let hasBlackMark = false;
  let hasLimeMark = false;
  for (let offset = 0; offset < corner.length; offset += 3) {
    const [red, green, blue] = corner.subarray(offset, offset + 3);
    if (red < 45 && green < 45 && blue < 45) hasBlackMark = true;
    if (red > 170 && green > 210 && blue < 90) hasLimeMark = true;
  }
  assert.ok(hasBlackMark && hasLimeMark, 'the official black and lime symbol colors must be visible');
  await assert.rejects(() => makeWatermarkedWebp(input, 'image/jpeg'), /do not match/i);
});

test('logo backing remains recognizable over a dark image', async () => {
  const input = await sharp({
    create: { width: 800, height: 800, channels: 3, background: { r: 12, g: 13, b: 14 } },
  }).png().toBuffer();
  const output = await makeWatermarkedWebp(input, 'image/png');
  const corner = await sharp(output).extract({ left: 690, top: 690, width: 100, height: 100 }).removeAlpha().raw().toBuffer();
  let hasLightBacking = false;
  let hasLimeMark = false;
  for (let offset = 0; offset < corner.length; offset += 3) {
    const [red, green, blue] = corner.subarray(offset, offset + 3);
    if (red > 220 && green > 220 && blue > 220) hasLightBacking = true;
    if (red > 170 && green > 210 && blue < 90) hasLimeMark = true;
  }
  assert.ok(hasLightBacking && hasLimeMark, 'the symbol badge must retain contrast on dark imagery');
});

test('synthetic CV PDF renders to a logo-watermarked WebP without changing the source', async () => {
  const source = await readFile(new URL('../showcase-demo-assets/preview-pipeline-test-cv.pdf', import.meta.url));
  const original = Buffer.from(source);

  const result = await renderPdf(Readable.from([source]));
  assert.equal(result.previews.length, 1);
  assert.match(result.overview.description, /official Formant symbol/i);
  const page = Buffer.from(result.previews[0].dataBase64, 'base64');
  assert.equal(page.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(page.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.ok(page.length <= 3 * 1024 * 1024);

  assert.deepEqual(source, original, 'the private PDF source must remain unchanged');
});
