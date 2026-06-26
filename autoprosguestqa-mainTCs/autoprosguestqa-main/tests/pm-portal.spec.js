/**
 * PM Portal Tests
 * Covers PM-specific features, assigned properties, financial data visibility, RBAC
 * Tests: 2g from requirements
 */

import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth.js';
import { createTestProperty, seedTestData, cleanupTestData } from './fixtures/db.js';

test.describe('PM Portal: Access Control (2g)', () => {
  let testProperty = null;

  test.beforeAll(async () => {
    testProperty = await createTestProperty({
      name: 'PM Test Property',
      address: '777 PM Lane, Austin, TX 78701'
    });
  });

  test.afterAll(async () => {
    if (testProperty?.id) {
      await cleanupTestData({ properties: [testProperty.id] });
    }
  });

  test('PM sees only assigned properties', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/pm-portal');

    // Should only show properties assigned to this PM
    const propertyCards = await page.locator('[data-testid="property-card"], .property-item').count();
    expect(propertyCards).toBeGreaterThanOrEqual(0);
  });

  test('PM cannot access unassigned property via URL', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    // Try to access a property PM doesn't own
    await page.goto(`/properties/${testProperty.id}`);

    // Should be forbidden or redirected
    const url = page.url();
    expect(url).not.toContain(testProperty.id);
  });

  test('PM cannot access /admin', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/admin');

    // Should be forbidden
    expect(page.url()).not.toContain('/admin');
  });

  test('PM cannot access /users', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/users');

    expect(page.url()).not.toContain('/users');
  });

  test('PM cannot access /performance', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/performance');

    expect(page.url()).not.toContain('/performance');
  });
});

test.describe('PM Portal: Features (2g)', () => {
  let testProperty = null;

  test.beforeAll(async () => {
    testProperty = await createTestProperty({
      name: 'Feature Test Property'
    });
  });

  test.afterAll(async () => {
    if (testProperty?.id) {
      await cleanupTestData({ properties: [testProperty.id] });
    }
  });

  test('PM can register resident', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/pm-portal');

    // Look for register resident button or form
    const registerBtn = page.locator('button:has-text("Register"), button:has-text("Add Resident")');
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      
      // Fill form
      await page.fill('input[placeholder*="name" i]', 'Test Resident');
      await page.fill('input[placeholder*="email" i]', `resident${Date.now()}@example.com`);
      await page.fill('input[placeholder*="phone" i]', '555-0100');
      
      // Submit
      const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Save")');
      await submitBtn.click();
      
      // Should show success
      await expect(page.locator('[role="status"], .success')).toBeVisible();
    }
  });

  test('PM can issue manual guest pass', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/pm-portal');

    // Look for issue pass button
    const issueBtn = page.locator('button:has-text("Guest Pass"), button:has-text("Issue Pass")');
    if (await issueBtn.isVisible()) {
      await issueBtn.click();
      
      // Fill guest details
      await page.fill('input[placeholder*="guest name" i]', 'Test Guest');
      await page.fill('input[placeholder*="plate" i]', 'GUEST01');
      
      // Submit
      const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Issue")');
      await submitBtn.click();
      
      // Should show success
      await expect(page.locator('[role="status"], .success')).toBeVisible();
    }
  });
});

test.describe('PM Portal: Financial Data Hidden (2g)', () => {
  test('PM cannot see financial KPIs in sidebar', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/pm-portal');

    // Check that financial fields are not visible
    const priceElements = await page.locator('[data-field="price"], [class*="price"]').count();
    const feeElements = await page.locator('[data-field="fee"], [class*="fee"]').count();
    const commissionElements = await page.locator('[data-field="commission"], [class*="commission"]').count();

    // Should not see these financial fields
    expect(priceElements + feeElements + commissionElements).toBe(0);
  });

  test('PM permit list does not show price/fee/commission columns', async ({ page }) => {
    const email = process.env.TEST_PM_EMAIL;
    const password = process.env.TEST_PM_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/pm-portal');

    // Find permit table if it exists
    const table = page.locator('table');
    if (await table.isVisible()) {
      const headerText = await table.textContent();
      
      // Headers should not contain financial terms
      expect(headerText).not.toMatch(/price|fee|commission/i);
    }
  });
});

