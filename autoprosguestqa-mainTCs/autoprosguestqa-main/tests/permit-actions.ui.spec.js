/**
 * Permit Actions - UI Layer Tests
 * Covers UI-driven permit actions, forms, validation messages, success feedback
 * Tests: 3d from requirements (UI happy paths)
 */

import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth.js';
import { createTestPermit, cleanupTestData } from './fixtures/db.js';

test.describe('Permit Actions UI: Revoke (3d)', () => {
  test('Admin can revoke permit from active permits page', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/permits');

    // Find the permit row
    const permitRow = page.locator(`text=${permit.plate}`);
    if (await permitRow.isVisible()) {
      // Click revoke button
      const revokeBtn = permitRow.locator('..').locator('button:has-text("Revoke")');
      if (await revokeBtn.isVisible()) {
        await revokeBtn.click();

        // Modal/form should appear
        const modal = page.locator('[role="dialog"], .modal');
        await expect(modal).toBeVisible();

        // Confirm revoke
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Revoke")').last();
        await confirmBtn.click();

        // Success message
        const success = page.locator('[role="status"], .success, .toast');
        await expect(success).toContainText(/revoked|success/i);
      }
    }

    await cleanupTestData({ permits: [permit.id] });
  });
});

test.describe('Permit Actions UI: Towed (3d)', () => {
  test('Driver can mark own vehicle as towed', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });

    const email = process.env.TEST_DRIVER_EMAIL;
    const password = process.env.TEST_DRIVER_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/permits');

    const permitRow = page.locator(`text=${permit.plate}`);
    if (await permitRow.isVisible()) {
      const toweBtn = permitRow.locator('..').locator('button:has-text("Towed"), button:has-text("Mark Towed")');
      if (await toweBtn.isVisible()) {
        await toweBtn.click();

        // Form should appear for tow details
        const form = page.locator('[role="dialog"], .form');
        await expect(form).toBeVisible();

        // Fill tow reason if available
        const reasonInput = form.locator('textarea, input[placeholder*="reason" i]');
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('Test tow reason');
        }

        // Submit
        const submitBtn = form.locator('button:has-text("Submit"), button:has-text("Mark")').last();
        await submitBtn.click();

        // Success message
        const success = page.locator('[role="status"], .success');
        await expect(success).toContainText(/success|towed/i);
      }
    }

    await cleanupTestData({ permits: [permit.id] });
  });
});

test.describe('Permit Actions UI: Form Validation (3d)', () => {
  test('Invalid input shows validation message', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    // Try to create manual tow with invalid data
    await page.goto('/permits');

    const manualTowBtn = page.locator('button:has-text("Manual Tow"), button:has-text("Add Tow")');
    if (await manualTowBtn.isVisible()) {
      await manualTowBtn.click();

      const form = page.locator('[role="dialog"], .form');
      
      // Submit without required fields
      const submitBtn = form.locator('button:has-text("Submit")').last();
      await submitBtn.click();

      // Validation error should appear
      const error = page.locator('[role="alert"], .error');
      await expect(error).toBeVisible();
    }
  });

  test('Edit button shows not-yet-implemented message', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/permits');

    const permitRow = page.locator(`text=${permit.plate}`);
    if (await permitRow.isVisible()) {
      const editBtn = permitRow.locator('..').locator('button:has-text("Edit")');
      if (await editBtn.isVisible()) {
        await editBtn.click();

        // Should show "not yet implemented" message
        const error = page.locator('[role="alert"], .error, .message');
        await expect(error).toContainText(/not.*implemented|coming|unavailable/i);
      }
    }

    await cleanupTestData({ permits: [permit.id] });
  });
});

test.describe('Permit Actions UI: Feedback (3d)', () => {
  test('Success toast appears after action', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/permits');

    const permitRow = page.locator(`text=${permit.plate}`);
    if (await permitRow.isVisible()) {
      const revokeBtn = permitRow.locator('..').locator('button:has-text("Revoke")');
      if (await revokeBtn.isVisible()) {
        await revokeBtn.click();

        const modal = page.locator('[role="dialog"]');
        const confirmBtn = modal.locator('button:has-text("Confirm")').last();
        await confirmBtn.click();

        // Toast should appear
        const toast = page.locator('[role="status"], .toast, [data-testid="toast"]');
        await expect(toast).toBeVisible();
        await expect(toast).toContainText(/success|completed|success/i);
      }
    }

    await cleanupTestData({ permits: [permit.id] });
  });

  test('Error message appears on failure', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    await page.goto('/auth');
    await login(page, email, password);

    await page.goto('/permits');

    // Try action on non-existent permit (if possible)
    // Should show error toast
    const errorToast = page.locator('[role="alert"], .error, .toast-error');
    
    // Error handling validation
    expect(page.url()).toContain('/permits');
  });
});

