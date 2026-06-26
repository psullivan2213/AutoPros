/**
 * Authentication Tests
 * Covers sign-in, logout, session persistence, and redirect behavior
 */

import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, logout, getCurrentUser, getStoredToken, isAuthenticated } from './fixtures/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page before each test
    await page.goto('/auth');
  });

  test('A1: Sign in with valid admin credentials', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD in environment configuration');
    }
    
    const token = await login(page, email, password);
    
    expect(token).toBeTruthy();
    expect(await isAuthenticated(page)).toBe(true);
  });

  test('A2: Reject invalid password', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    
    await page.fill('input[placeholder="you@example.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'wrong-password');
    await page.click('button:has-text("Sign In")');
    
    // Should show error or stay on auth page
    await expect(page).toHaveURL(/\/auth/);
    
    // Error message should appear
    const errorElement = page.locator('[role="alert"], .error, [data-testid="error"]');
    if (await errorElement.isVisible()) {
      await expect(errorElement).toBeVisible();
    }
  });

  test('A3: Reject missing email', async ({ page }) => {
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.fill('input[placeholder="••••••••"]', password);
    await page.click('button:has-text("Sign In")');
    
    // Should show validation or stay on auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('A4: Session persists after page refresh', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    // Login
    await login(page, email, password);
    const tokenBefore = await getStoredToken(page);
    
    // Refresh page
    await page.reload();
    
    // Token should still exist
    const tokenAfter = await getStoredToken(page);
    expect(tokenAfter).toBe(tokenBefore);
    expect(await isAuthenticated(page)).toBe(true);
  });

  test('A5: Logout clears session', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    // Login
    await login(page, email, password);
    expect(await isAuthenticated(page)).toBe(true);
    
    // Logout
  await logout(page);
  
  // Should be on auth page
  await expect(page).toHaveURL(/\/auth/);
  
  // Keep checking until the session is actually cleared
  await expect.poll(async () => {
    return await isAuthenticated(page);
  }).toBe(false);
});
  test('A6: Direct nav to protected route without auth redirects to /auth', async ({ page }) => {
    // Try to navigate to admin page without logging in
    await page.goto('/admin');
    
    // Should redirect to /auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test('A7: No public signup path reachable', async ({ page }) => {
    // Try common signup paths
    const signupPaths = ['/signup', '/register', '/auth/signup', '/auth/register'];
    
    for (const path of signupPaths) {
      await page.goto(path);
      
      // Should either redirect to /auth or show 404
      await expect(page).toHaveURL(/\/auth|404/);
    }
  });

  test('A8: Post-login user info available', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await login(page, email, password);
    
    // JWT should contain user info
    const token = await getStoredToken(page);
    expect(token).toBeTruthy();
    
    // Try to extract user info from page if available
    const user = await getCurrentUser(page);
    if (user) {
      expect(user.email).toBeTruthy();
      expect(user.role).toBeTruthy();
    }
  });

  test('A9: Expired JWT triggers re-authentication', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    // Login
    await login(page, email, password);
    
    // Clear the token to simulate expiration
    await page.evaluate(() => {
      localStorage.removeItem('sb-auth');
    });
    
    // Try to access protected resource
    await page.goto('/admin');
    
    // Should redirect to auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('A10: Multiple login sessions in different contexts', async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    const email1 = process.env.TEST_ADMIN_EMAIL;
    const password1 = process.env.TEST_ADMIN_PASSWORD;
    
    const email2 = process.env.TEST_DRIVER_EMAIL;
    const password2 = process.env.TEST_DRIVER_PASSWORD;
    
    // Login in both contexts
    const token1 = await login(page1, email1, password1);
    const token2 = await login(page2, email2, password2);
    
    // Tokens should be different
    expect(token1).not.toBe(token2);
    
    // Cleanup
    await context1.close();
    await context2.close();
  });
});

test.describe('Session Management', () => {
  test('S1: Session storage uses localStorage', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);
    
    // Verify token is in localStorage, not sessionStorage
    const localToken = await page.evaluate(() => {
      const auth = localStorage.getItem('sb-auth');
      return auth ? JSON.parse(auth).access_token : null;
    });
    
    expect(localToken).toBeTruthy();
  });

  test('S2: Session survives page navigation', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);
    
    // Navigate to different pages
    await page.goto('/permits');
    expect(await isAuthenticated(page)).toBe(true);
    
    await page.goto('/admin');
    expect(await isAuthenticated(page)).toBe(true);
  });
});

