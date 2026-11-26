import { test, expect } from '@playwright/test';

test('home picker flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Free online file converter' })).toBeVisible();
  const from = page.getByLabel('Convert from');
  await from.click();
  await from.fill('jpeg');
  await expect(page.getByRole('option', { name: /JPG/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  const to = page.getByLabel('Convert to');
  await expect(to).toBeEnabled();
  await to.click();
  await to.fill('png');
  await page.keyboard.press('Enter');
  const start = page.getByRole('link', { name: /Start converting/ });
  await expect(start).toBeVisible();
  await expect(start).toHaveAttribute('href', '/convert/jpg-to-png');
  await expect(start).toHaveAttribute('target', '_blank');
  await expect(page.getByText('JPG → PNG')).toBeVisible();
});

test('all formats section lists crawlable pair links', async ({ page }) => {
  await page.goto('/#formats');
  await expect(page.getByText(/converters/)).toBeVisible();
  const link = page.locator('a[href="/convert/png-to-jpg"]').first();
  await expect(link).toBeVisible();
});
