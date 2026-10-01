import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

test('installed update waits without reloading or losing the active draw', async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'Service Worker lifecycle is verified once in desktop Chromium.');
  let revision = 1;
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      let body = await readFile(file);
      if (path === '/sw.js') body = Buffer.concat([body, Buffer.from(`\n// test revision ${revision}\n`)]);
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  try {
    await page.goto(url);
    await expect(page.locator('#offline')).toHaveText('Готов к работе');
    await page.reload();
    await page.locator('#count').fill('20');
    await page.locator('#start').click();
    await page.getByRole('switch').uncheck();
    await page.locator('#draw').click();
    await expect(page.locator('#history li')).toHaveCount(1);
    const selected = await page.locator('#number').textContent();
    await page.evaluate(() => { document.body.dataset.noReload = 'yes'; });
    revision++;
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
    expect(await page.locator('body').getAttribute('data-no-reload')).toBe('yes');
    await expect(page.locator('#number')).toHaveText(selected!);
    await page.locator('#draw').click();
    await expect(page.locator('#history li')).toHaveCount(2);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(url);
    await expect(reopened.locator('#history li')).toHaveCount(2);
    await expect(reopened.locator('#remaining')).toHaveText('Осталось 18 из 20');
    await reopened.close();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
