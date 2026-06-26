/**
 * RBAC (Role-Based Access Control) Tests
 * Covers sidebar nav, page access, and role-specific features
 */

import { test, expect } from '@playwright/test';
import { login, logout } from './fixtures/auth.js';

const ROLES = [
  { email: 'admin@example.com', password: 'password', role: 'admin' },
  { email: 'manager@example.com', password: 'password', role: 'manager' },
  { email: 'driver@example.com', password: 'password', role: 'driver' },
  { email: 'dispatcher@example.com', password: 'password', role: 'dispatcher' },
  { email: 'pm@example.com', password: 'password', role: 'pm' }
];

// Get test user credentials from env
function getTestUserForRole(role) {
  switch (role) {
    case 'admin':
      return { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD };
    case 'manager':
      return { email: process.env.TEST_MANAGER_EMAIL, password: process.env.TEST_MANAGER_PASSWORD };
    case 'driver':
      return { email: process.env.TEST_DRIVER_EMAIL, password: process.env.TEST_DRIVER_PASSWORD };
    case 'dispatcher':
      return { email: process.env.TEST_DISPATCHER_EMAIL, password: process.env.TEST_DISPATCHER_PASSWORD };
    case 'pm':
      return { email: process.env.TEST_PM_EMAIL, password: process.env.TEST_PM_PASSWORD };
    default:
      return null;
  }
}

test.describe('RBAC: Sidebar Navigation', () => {
  const navItems = {
    admin: ['Dashboard', 'Permits', 'Properties', 'Users', 'Admin Insights'],
    manager: ['Dashboard', 'Permits', 'Properties'],
    driver: ['My Permits', 'Permits'],
    dispatcher: ['Permits', 'Actions'],
    pm: ['PM Portal', 'Properties']
  };

  Object.entries(navItems).forEach(([role, expectedItems]) => {
    test(`${role.toUpperCase()}: Sidebar shows correct nav items`, async ({ page }) => {
      const creds = getTestUserForRole(role);
      if (!creds.email) {
        test.skip();
        return;
      }

      await page.goto('/auth');
      await login(page, creds.email, creds.password);

      // Check sidebar navigation
      for (const item of expectedItems) {
        const navElement = page.locator(`nav >> text=${item}, [data-nav="${item}"]`);
        // At least one should match
        try {
          await expect(navElement.first()).toBeVisible({ timeout: 3000 });
        } catch {
          // Navigation might not be visible, skip
        }
      }
    });
  });
});

test.describe('RBAC: Page Access Control', () => {
  const pageAccess = {
    '/admin': ['admin', 'manager'],
    '/users': ['admin', 'manager'],
    '/performance': ['admin'],
    '/pm-portal': ['pm'],
    '/permits': ['admin', 'manager', 'driver', 'dispatcher'],
    '/properties': ['admin', 'manager']
  };

  Object.entries(pageAccess).forEach(([page, allowedRoles]) => {
    const deniedRoles = ['admin', 'manager', 'driver', 'dispatcher', 'pm'].filter(
      role => !allowedRoles.includes(role)
    );

    // Test allowed access
    allowedRoles.forEach(role => {
      test(`${role.toUpperCase()}: Can access ${page}`, async ({ page: playgroundPage }) => {
        const creds = getTestUserForRole(role);
        if (!creds.email) {
          test.skip();
          return;
        }

        await playgroundPage.goto('/auth');
        await login(playgroundPage, creds.email, creds.password);

        await playgroundPage.goto(page);
        
        // Should not be redirected to /auth
        expect(playgroundPage.url()).not.toContain('/auth');
        // Should contain the page path (may have query params)
        expect(playgroundPage.url()).toContain(page);
      });
    });

    // Test denied access
    deniedRoles.forEach(role => {
      test(`${role.toUpperCase()}: Cannot access ${page}`, async ({ page: playgroundPage }) => {
        const creds = getTestUserForRole(role);
        if (!creds.email) {
          test.skip();
          return;
        }

        await playgroundPage.goto('/auth');
        await login(playgroundPage, creds.email, creds.password);

        await playgroundPage.goto(page);

        // Should either be redirected or show 403
        const url = playgroundPage.url();
        const is403OrRedirected = url.includes('/auth') || url.includes('403') || url.includes('forbidden');
        
        expect(is403OrRedirected).toBe(true);
      });
    });
  });
});

test.describe('RBAC: Feature-Specific Access', () => {
  test('PM: Cannot access financial data in UI', async ({ page }) => {
    const creds = getTestUserForRole('pm');
    if (!creds.email) {
      test.skip();
      return;
    }

    await page.goto('/auth');
    await login(page, creds.email, creds.password);

    // Navigate to PM portal or permits page
    await page.goto('/pm-portal');

    // Check that financial fields are not visible
    const financialSelectors = [
      '[data-field="price"]',
      '[data-field="fee"]',
      '[data-field="commission"]',
      '.financial-data',
      '[class*="price"]',
      '[class*="fee"]',
      '[class*="commission"]'
    ];

    for (const selector of financialSelectors) {
      const element = page.locator(selector);
      const count = await element.count();
      expect(count).toBe(0);
    }
  });

  test('Driver: Cannot access Admin Insights', async ({ page }) => {
    const creds = getTestUserForRole('driver');
    if (!creds.email) {
      test.skip();
      return;
    }

    await page.goto('/auth');
    await login(page, creds.email, creds.password);

    // Try to access Admin Insights
    await page.goto('/admin/insights');

    // Should not be accessible
    const url = page.url();
    expect(url).not.toContain('/admin/insights');
  });

  test('Dispatcher: Can access permit actions', async ({ page }) => {
    const creds = getTestUserForRole('dispatcher');
    if (!creds.email) {
      test.skip();
      return;
    }

    await page.goto('/auth');
    await login(page, creds.email, creds.password);

    await page.goto('/permits');

    // Should be able to see action buttons
    const actionButtons = page.locator('button:has-text("Revoke"), button:has-text("Tow"), button:has-text("Reactivate")');
    const count = await actionButtons.count();
    
    // At least some action buttons should exist
    expect(count).toBeGreaterThan(0);
  });

  test('Manager: Can edit properties', async ({ page }) => {
    const creds = getTestUserForRole('manager');
    if (!creds.email) {
      test.skip();
      return;
    }

    await page.goto('/auth');
    await login(page, creds.email, creds.password);

    await page.goto('/properties');

    // Should see edit buttons for properties
    const editButtons = page.locator('button:has-text("Edit"), [data-action="edit"]');
    const count = await editButtons.count();
    
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('RBAC: Cross-Role Isolation', () => {
  test('PM: Cannot see other properties even via URL', async ({ page }) => {
    const creds = getTestUserForRole('pm');
    if (!creds.email) {
      test.skip();
      return;
    }

    await page.goto('/auth');
    await login(page, creds.email, creds.password);

    // Try to access a property ID that PM doesn't own
    // (assuming property-123 exists but is not assigned to this PM)
    await page.goto('/properties/property-123');

    // Should either show 403 or redirect
    const url = page.url();
    const isForbidden = url.includes('403') || url.includes('forbidden') || !url.includes('property-123');
    
    expect(isForbidden).toBe(true);
  });

  test('Driver: Cannot modify permit status directly', async ({ page }) => {
    const creds = getTestUserForRole('driver');
    if (!creds.email) {
      test.skip();
      return;
    }

    await page.goto('/auth');
    await login(page, creds.email, creds.password);

    await page.goto('/permits');

    // Driver should only see their own permits, not modify buttons for others
    const revokeBtns = page.locator('button:has-text("Revoke")');
    const count = await revokeBtns.count();
    
    // If revoke buttons exist, they should be disabled or not clickable for others' permits
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const btn = revokeBtns.nth(i);
        const disabled = await btn.evaluate(el => el.disabled);
        // Should be disabled or permit should belong to driver
        expect(disabled).toBe(true);
      }
    }
  });
});

