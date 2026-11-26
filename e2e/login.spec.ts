import { test, expect } from '@playwright/test';

test('login page renders with tabs', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('pricing page renders plan cards', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
  await expect(page.getByText('Free', { exact: true }).first()).toBeVisible();
});
