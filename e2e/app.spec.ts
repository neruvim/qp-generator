import { test, expect, type Page } from '@playwright/test';

async function start(page: Page, total: string) {
  await page.goto('/');
  await page.getByLabel('Количество участников').fill(total);
  await page.getByRole('button', { name: 'Начать розыгрыш' }).click();
  await expect(page.locator('#draw-screen')).toBeVisible();
}

test('validation, full draw, restoration and confirmed reset', async ({ page }) => {
  await page.goto('/');
  for (const value of ['', '0', '-1', '2.5', '9007199254740992']) {
    await page.getByLabel('Количество участников').fill(value);
    await page.getByRole('button', { name: 'Начать розыгрыш' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await page.getByLabel('Количество участников').fill('3');
  await page.getByRole('button', { name: 'Начать розыгрыш' }).click();
  await page.getByRole('switch', { name: 'Анимация' }).uncheck();
  for (let i = 0; i < 3; i++) {
    await page.locator('#draw').click();
    await expect(page.locator('#history li')).toHaveCount(i + 1);
  }
  const values = await page.locator('#history li').allTextContents();
  expect(values.sort()).toEqual(['1', '2', '3']);
  await expect(page.locator('#draw')).toBeDisabled();
  const result = await page.locator('#number').textContent();
  await page.reload();
  await expect(page.locator('#number')).toHaveText(result!);
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.locator('#history li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByLabel('Количество участников')).toHaveValue('3');
  await page.reload();
  await expect(page.getByLabel('Количество участников')).toHaveValue('3');
});

test('saved before animation, repeated clicks blocked', async ({ page }) => {
  await start(page, '20');
  await page.locator('#draw').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click(); });
  await expect(page.locator('#draw')).toBeDisabled();
  await expect(page.locator('#number')).toHaveClass('rolling');
  await page.reload();
  await expect(page.locator('#history li')).toHaveCount(1);
  await expect(page.locator('#remaining')).toHaveText('Осталось 19 из 20');
  await expect(page.locator('#number')).not.toHaveClass('rolling');
});

test('second tab takes control only after first closes', async ({ page, context }) => {
  await start(page, '1');
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('#access')).toContainText('другой вкладке');
  await expect(second.locator('#draw-screen')).toBeHidden();
  await page.close();
  await expect(second.locator('#draw-screen')).toBeVisible();
  await second.getByRole('switch').uncheck();
  await second.locator('#draw').click();
  await expect(second.locator('#number')).toHaveText('1');
});

test('huge count and long numbers fit phone viewport', async ({ page }) => {
  await start(page, '9007199254740991');
  await page.getByRole('switch').uncheck();
  for (let i = 0; i < 3; i++) {
    await page.locator('#draw').click();
    await expect(page.locator('#history li')).toHaveCount(i + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#number').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('prepared app launches and completes a draw offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright offline + service worker coverage is run in Chromium.');
  await page.goto('/');
  await expect(page.locator('#offline')).toHaveText('Готов к работе');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Количество участников').fill('2');
  await page.getByRole('button', { name: 'Начать розыгрыш' }).click();
  await page.getByRole('switch').uncheck();
  await page.locator('#draw').click();
  await expect(page.locator('#history li')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#history li')).toHaveCount(1);
  await page.locator('#draw').click();
  await expect(page.locator('#draw')).toHaveText('Розыгрыш завершён');
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByLabel('Количество участников')).toHaveValue('2');
  await page.getByRole('button', { name: 'Начать розыгрыш' }).click();
  await page.getByRole('switch').check();
  await page.locator('#draw').click();
  await expect(page.locator('#number')).toHaveClass('rolling');
  await expect(page.locator('#history li')).toHaveCount(1);
});

test('write failure does not reveal an uncommitted result', async ({ page }) => {
  await start(page, '20');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'history') throw new DOMException('Simulated disk full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.locator('#draw').click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.locator('#number')).toHaveText('');
  await expect(page.locator('#result-label')).toBeHidden();
  await expect(page.locator('#remaining')).toHaveText('Осталось 20 из 20');
  await page.reload();
  await expect(page.locator('#number')).toHaveText('');
  await expect(page.locator('#history li')).toHaveCount(0);
  await page.getByRole('switch').uncheck();
  await page.locator('#draw').click();
  await expect(page.locator('#history li')).toHaveCount(1);
});

test('history is bounded and reduced motion skips animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, '10000');
  for (let i = 0; i < 55; i++) {
    await page.locator('#draw').click();
    await expect(page.locator('#remaining')).toHaveText(`Осталось ${9999 - i} из 10000`);
  }
  await expect(page.locator('#history li')).toHaveCount(50);
  await expect(page.locator('#page-label')).toHaveText('1 / 2');
  await expect(page.locator('#history li').first()).toHaveAttribute('title', 'Выбор № 55');
  await page.getByRole('button', { name: 'Следующая страница' }).click();
  await expect(page.locator('#history li')).toHaveCount(5);
  await expect(page.locator('#history li').first()).toHaveAttribute('title', 'Выбор № 5');
  await expect(page.locator('#number')).not.toHaveClass('rolling');
  await page.reload();
  await expect(page.locator('#history li')).toHaveCount(50);
  await expect(page.locator('#history li').first()).toHaveAttribute('title', 'Выбор № 55');
});
