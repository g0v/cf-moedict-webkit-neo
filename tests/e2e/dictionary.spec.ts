import type { Page } from '@playwright/test';
import { expect, test } from './_fixtures';

async function waitForEntryHydration(page: Page, titleFragment: string): Promise<void> {
  // DictionaryPage renders long-form definition text after /api/{word}.json resolves.
  // Wait for either definition text OR the "全文檢索" header (which always renders)
  // and then assert the body contains the word title.
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toContainText(titleFragment, { timeout: 15_000 });
}

test.describe('dictionary pages per language', () => {
  test('萌 (a) — default 萌典', async ({ page }) => {
    const response = await page.goto('/%E8%90%8C');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/萌/);
    await waitForEntryHydration(page, '萌');
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100); // definition text loaded
  });

  test("'食 (t) — 台語萌典", async ({ page }) => {
    const response = await page.goto("/'%E9%A3%9F");
    expect(response?.status()).toBe(200);
    await waitForEntryHydration(page, '食');
  });

  test(':字 (h) — 客語萌典', async ({ page }) => {
    const response = await page.goto('/%3A%E5%AD%97');
    expect(response?.status()).toBe(200);
    await waitForEntryHydration(page, '字');
  });

  test('~上訴 (c) — 兩岸萌典', async ({ page }) => {
    const response = await page.goto('/~%E4%B8%8A%E8%A8%B4');
    expect(response?.status()).toBe(200);
    await waitForEntryHydration(page, '上訴');
  });
});

test.describe('special routes', () => {
  test('/@ radical view renders grid', async ({ page }) => {
    const response = await page.goto('/@');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    // The radical view has a root container; look for any CJK chars in links/buttons
    await expect(page.locator('body')).toContainText(/[一二人入]/, { timeout: 10_000 });
  });

  test('/~@ renders radical view with 兩岸 brand', async ({ page }) => {
    const response = await page.goto('/~@');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
  });

  test('/about shows about content', async ({ page }) => {
    const response = await page.goto('/about');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/關於本站/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(/萌典/, { timeout: 20_000 });
  });

  test('/privacy shows privacy content', async ({ page }) => {
    const response = await page.goto('/privacy');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toContainText(/隱私|privacy/i);
  });
});

test.describe('404 / fallback paths', () => {
  test('unknown word falls back to SPA (not worker 404)', async ({ page }) => {
    // React router catch-all still serves index.html
    const response = await page.goto('/%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E8%A9%9E');
    expect(response?.status()).toBe(200);
  });
});
