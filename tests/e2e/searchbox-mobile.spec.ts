import { expect, test } from './_fixtures';

test.describe('mobile sidebar search toggle', () => {
  test.use({
    viewport: { width: 375, height: 700 },
  });

  test('keeps the results toggle from blurring the searchbox first (#108)', async ({ page }) => {
    await page.goto('/%E8%90%8C');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#query');
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();

    const toggle = page.getByRole('button', { name: /列出所有含有「萌」的詞/ });
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const pointerDownDefaultPrevented = await toggle.evaluate((button) => {
      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
      });
      button.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(pointerDownDefaultPrevented).toBe(true);

    await input.evaluate((element) => {
      element.dispatchEvent(new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: null,
      }));
    });
    await toggle.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }));
    });

    await expect(page.locator('#sidebar-search-results')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);
    await expect(page.locator('#sidebar-search-results')).toBeVisible();
  });

  test('closes expanded results when pressing outside without relying on blur', async ({ page }) => {
    await page.goto('/%E8%90%8C');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#query');
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();

    const toggle = page.getByRole('button', { name: /列出所有含有「萌」的詞/ });
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
      }));
      button.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }));
    });

    const results = page.locator('#sidebar-search-results');
    await expect(results).toBeVisible({ timeout: 10_000 });

    await page.locator('#main-content').dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    });
    await expect(results).toBeHidden();
  });
});
