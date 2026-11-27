const { test, expect } = require('@playwright/test');

test('resource facets and favorites panels are wired into the RTL dashboard shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/teacher-community.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#tc-level')).toBeAttached();
  await expect(page.locator('#tc-stream')).toBeAttached();
  await expect(page.locator('#tc-language')).toBeAttached();
  await expect(page.locator('#tc-school-year-filter')).toBeAttached();
  await expect(page.locator('#tc-file-chapter')).toBeAttached();
  await expect(page.locator('#tc-file-theme')).toBeAttached();
  await expect(page.locator('#tc-edit-chapter')).toBeAttached();
  await expect(page.locator('#tc-edit-theme')).toBeAttached();

  await page.locator('#tc-dashboard').evaluate(element => { element.hidden = false; });
  await page.getByRole('tab', { name: 'مواردي المفضلة' }).click();
  await expect(page.locator('#tc-favorites-panel')).toBeVisible();
  await expect(page.locator('#tc-favorites-grid')).toBeAttached();
  await expect(page.locator('#tc-favorites-more')).toBeAttached();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
