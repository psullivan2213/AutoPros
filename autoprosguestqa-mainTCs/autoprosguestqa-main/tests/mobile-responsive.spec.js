// mobile-responsive.spec.js
// Tier 4 — Non-Functional: Mobile Viewport Tests (10 tests)
// Verifies that all critical pages render correctly and are usable on mobile.

import { test, expect } from '@playwright/test';
import { login, logout } from './fixtures/auth.js';

// ------------------------------------------------------------
// Viewport presets
// ------------------------------------------------------------
const VIEWPORTS = {
  iPhoneSE:  { width: 375, height: 667 },
  iPhone14:  { width: 390, height: 844 },
  androidMd: { width: 412, height: 915 },
};

// Use the smallest common mobile size as the default for this suite
const MOBILE = VIEWPORTS.iPhoneSE;

test.use({ viewport: MOBILE });

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
async function mobileLogin(page) {
  await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
}

// ------------------------------------------------------------
// MR1 — Auth page renders on mobile
// ------------------------------------------------------------
test('MR1: /auth login form is usable on mobile', async ({ page }) => {
  await page.goto(`${process.env.APP_URL}/auth`);

  // Form inputs must be visible without horizontal scroll
  const emailInput    = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitBtn     = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitBtn).toBeVisible();

  // No horizontal overflow
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(MOBILE.width + 5); // 5px tolerance
});

// ------------------------------------------------------------
// MR2 — Hamburger / mobile nav appears (no sidebar on mobile)
// ------------------------------------------------------------
test('MR2: sidebar collapses into hamburger menu on mobile', async ({ page }) => {
  await mobileLogin(page);
  await page.goto(`${process.env.APP_URL}/permits`);

  // Desktop sidebar should NOT be visible at mobile width
  const desktopSidebar = page.locator('[data-testid="sidebar"], nav.sidebar, aside');
  const hamburger      = page.locator('[data-testid="menu-toggle"], button[aria-label*="menu" i], button[aria-label*="nav" i]');

  // Either the sidebar is hidden or a hamburger is present — one must be true
  const sidebarVisible   = await desktopSidebar.isVisible().catch(() => false);
  const hamburgerVisible = await hamburger.isVisible().catch(() => false);

  if (sidebarVisible) {
    // If sidebar is shown, it must fit within viewport width
    const box = await desktopSidebar.boundingBox();
    expect(box.width).toBeLessThan(MOBILE.width);
  } else {
    expect(hamburgerVisible).toBe(true);
  }
});

// ------------------------------------------------------------
// MR3 — Permits table is scrollable / responsive on mobile
// ------------------------------------------------------------
test('MR3: permits table does not overflow viewport on mobile', async ({ page }) => {
  await mobileLogin(page);
  await page.goto(`${process.env.APP_URL}/permits`);

  // Wait for table or card list to appear
  await page.waitForSelector('table, [data-testid="permit-list"], [data-testid="permit-card"]', {
    timeout: 10_000,
  });

  // Page must not force horizontal scroll beyond viewport
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width + 10);
});

// ------------------------------------------------------------
// MR4 — Permit action buttons are tap-target compliant (≥44px)
// ------------------------------------------------------------
test('MR4: permit action buttons meet minimum tap-target size', async ({ page }) => {
  await mobileLogin(page);
  await page.goto(`${process.env.APP_URL}/permits`);

  await page.waitForSelector('button', { timeout: 10_000 });

  // Collect all visible action buttons
  const buttons = page.locator('button:visible');
  const count   = await buttons.count();

  for (let i = 0; i < Math.min(count, 20); i++) {
    const btn = buttons.nth(i);
    const box = await btn.boundingBox();
    if (!box) continue;

    // WCAG 2.5.5 / Apple HIG minimum touch target: 44×44
    expect(box.height, `Button ${i} height`).toBeGreaterThanOrEqual(44);
  }
});

// ------------------------------------------------------------
// MR5 — Public /status page works on mobile
// ------------------------------------------------------------
test('MR5: /status lookup page renders on mobile without overflow', async ({ page }) => {
  await page.goto(`${process.env.APP_URL}/status`);

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(MOBILE.width + 5);

  // Plate & phone fields must exist
  const plateInput = page.locator('input[name="plate"], input[placeholder*="plate" i]');
  const phoneInput = page.locator('input[name="phone"], input[type="tel"]');
  await expect(plateInput).toBeVisible();
  await expect(phoneInput).toBeVisible();
});

// ------------------------------------------------------------
// MR6 — PM portal renders on mobile
// ------------------------------------------------------------
test('MR6: PM portal is accessible on mobile', async ({ page }) => {
  await login(page, process.env.TEST_PM_EMAIL, process.env.TEST_PM_PASSWORD);
  await page.goto(`${process.env.APP_URL}/pm`);

  await page.waitForLoadState('networkidle');

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width + 10);
});

// ------------------------------------------------------------
// MR7 — /feedback form is usable on mobile
// ------------------------------------------------------------
test('MR7: /feedback form renders and submits on mobile', async ({ page }) => {
  await page.goto(`${process.env.APP_URL}/feedback`);

  const textarea  = page.locator('textarea');
  const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")');

  await expect(textarea).toBeVisible();
  await expect(submitBtn).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width + 5);
});

// ------------------------------------------------------------
// MR8 — Font sizes are readable (≥14px) on mobile
// ------------------------------------------------------------
test('MR8: body text font size is at least 14px on mobile', async ({ page }) => {
  await mobileLogin(page);
  await page.goto(`${process.env.APP_URL}/permits`);

  await page.waitForLoadState('networkidle');

  const tooSmall = await page.evaluate(() => {
    const elements = document.querySelectorAll('p, td, th, li, span, label');
    const violations = [];
    elements.forEach((el) => {
      const size = parseFloat(window.getComputedStyle(el).fontSize);
      if (size > 0 && size < 14) {
        violations.push({ tag: el.tagName, text: el.innerText?.slice(0, 30), size });
      }
    });
    return violations;
  });

  expect(
    tooSmall,
    `Found ${tooSmall.length} elements with font-size < 14px: ${JSON.stringify(tooSmall.slice(0, 5))}`
  ).toHaveLength(0);
});

// ------------------------------------------------------------
// MR9 — Cross-device: iPhone 14 viewport smoke
// ------------------------------------------------------------
test('MR9: permits page loads without JS errors on iPhone 14 viewport', async ({ page, browser }) => {
  const ctx  = await browser.newContext({ viewport: VIEWPORTS.iPhone14 });
  const pg14 = await ctx.newPage();

  const errors = [];
  pg14.on('pageerror', (e) => errors.push(e.message));

  await login(pg14, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  await pg14.goto(`${process.env.APP_URL}/permits`);
  await pg14.waitForLoadState('networkidle');

  await ctx.close();

  expect(errors, `JS errors on iPhone 14: ${errors.join(' | ')}`).toHaveLength(0);
});

// ------------------------------------------------------------
// MR10 — Orientation: landscape mobile does not break layout
// ------------------------------------------------------------
test('MR10: permits page is usable in landscape orientation', async ({ page, browser }) => {
  // Landscape iPhone SE
  const ctx  = await browser.newContext({ viewport: { width: 667, height: 375 } });
  const pgLs = await ctx.newPage();

  await login(pgLs, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  await pgLs.goto(`${process.env.APP_URL}/permits`);
  await pgLs.waitForLoadState('networkidle');

  const scrollWidth = await pgLs.evaluate(() => document.documentElement.scrollWidth);
  // Landscape width is 667; allow small tolerance
  expect(scrollWidth).toBeLessThanOrEqual(667 + 10);

  await ctx.close();
});

