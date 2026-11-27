const { test, expect } = require('@playwright/test');

test('professional profile panel remains RTL and usable on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/teacher-community.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#tc-profile-form')).toHaveCount(1);

  // The real dashboard is authentication-gated. Reveal only the static dashboard
  // shell for this layout/navigation test; database writes are covered by PGlite.
  await page.locator('#tc-dashboard').evaluate(element => { element.hidden = false; });
  await page.getByRole('tab', { name: 'ملفي المهني' }).click();
  await expect(page.locator('#tc-profile-panel')).toBeVisible();
  await expect(page.locator('#tc-profile-name')).toBeVisible();
  await expect(page.locator('#tc-profile-bio')).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظ الملف المهني' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(page.locator('#tc-profile-panel')).toBeVisible();
});
