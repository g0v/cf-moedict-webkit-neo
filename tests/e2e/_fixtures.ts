import { test as base, expect } from '@playwright/test';

/**
 * Block requests to the fake `r2-assets.test.local` hostname so Playwright
 * doesn't wait for them to DNS-fail. This trims ~20s per test on networkidle.
 * Local assets served by our Miniflare fixture are reached via /assets/* and
 * pass through untouched.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.route(/^https?:\/\/r2-[a-z]+\.test\.local\//, (route) => {
      return route.fulfill({
        status: 404,
        contentType: 'application/octet-stream',
        body: '',
      });
    });
    await run(page);
  },
});

export { expect };
