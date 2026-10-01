import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const publicDirectory = new URL('../public/', import.meta.url);
const svg = await readFile(new URL('icon.svg', publicDirectory), 'utf8');
const variants = [
  { name: 'icon-192.png', size: 192, background: 'transparent' },
  { name: 'icon-512.png', size: 512, background: 'transparent' },
  { name: 'icon-maskable-512.png', size: 512, background: '#6027aa' },
  { name: 'apple-touch-icon.png', size: 180, background: '#6027aa' },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { name, size, background } of variants) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>
      html,body{margin:0;width:100%;height:100%;background:${background}}
      svg{display:block;width:100%;height:100%}
    </style>${svg}`);
    const png = await page.screenshot({
      path: fileURLToPath(new URL(name, publicDirectory)),
      omitBackground: background === 'transparent',
    });
    if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size)
      throw new Error(`Unexpected dimensions: ${name}`);
    console.log(`${name}: ${size} x ${size}`);
  }
} finally {
  await browser.close();
}
