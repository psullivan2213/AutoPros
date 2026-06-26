import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Authentication Fixtures & Helpers
 * Provides login functionality and session management for tests
 */

/**
 * Login to the application
 * @param {Page} page - Playwright page object
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} - JWT token if available
 */
export async function login(page, email, password) {
  // Prefer programmatic Supabase login when credentials and endpoint are available.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && email && password) {
    try {
      const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ email, password })
      });

      if (resp.ok) {
        const data = await resp.json();
        const authString = JSON.stringify(data);
        const projectRefMatch = supabaseUrl.match(/^https?:\/\/([^\.]+)\./);
        const projectRef = projectRefMatch ? projectRefMatch[1] : null;

        await page.addInitScript((value, ref) => {
          localStorage.setItem('sb-auth', value);
          if (ref) {
            localStorage.setItem(`sb-${ref}-auth-token`, value);
          }
        }, authString, projectRef);

        await page.goto('/');
        await waitForAuth(page, 5000);
        const token = await getStoredToken(page);
        if (!token) {
          throw new Error('Programmatic login succeeded but no auth token was detected in localStorage');
        }
        return token;
      }
      // otherwise fall through to UI flow
    } catch (e) {
      // ignore and fallback to UI login
    }
  }

  // Fallback: perform UI-driven login
  await page.goto('/auth');
  await page.fill('input[placeholder="you@example.com"]', email);
  await page.fill('input[placeholder="••••••••"]', password);
  // Click sign-in and handle possible provider popup flow
  const popupPromise = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
  await page.click('button:has-text("Sign In")');
  const popup = await popupPromise;

  if (popup) {
    try {
      // Attempt to fill common popup fields (best-effort)
      await popup.fill('input[type="email"], input[placeholder*="email"]', email).catch(() => {});
      await popup.fill('input[type="password"], input[placeholder*="password"]', password).catch(() => {});
      await popup.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Continue")').catch(() => {});
      // Wait for popup to close or navigation to root
      await popup.waitForClose({ timeout: 10000 }).catch(() => {});
    } catch (e) {
      // ignore and continue to wait for main page navigation
    }
  }

  // Wait for auth token storage after login completion.
  await waitForAuth(page, 15000);

  return getStoredToken(page);
}

/**
 * Get JWT token from localStorage
 * @param {Page} page - Playwright page object
 * @returns {string} - JWT token
 */
export function getStoredToken(page) {
  return page.evaluate(() => {
    function parseStoredValue(value) {
      if (!value) return null;
      try {
        const parsed = JSON.parse(value);
        return parsed?.access_token || parsed?.accessToken || null;
      } catch {
        return value;
      }
    }

    const sbAuth = localStorage.getItem('sb-auth');
    if (sbAuth) {
      return parseStoredValue(sbAuth);
    }

    for (const key of Object.keys(localStorage)) {
      if (/^sb-[^-]+-auth-token$/.test(key)) {
        const value = localStorage.getItem(key);
        const parsed = parseStoredValue(value);
        if (parsed) return parsed;
      }
    }

    return null;
  });
}

/**
 * Wait for authentication to complete (JWT token stored)
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in ms
 */
export async function waitForAuth(page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      const auth = localStorage.getItem('sb-auth');
      if (auth) {
        try {
          return JSON.parse(auth).access_token;
        } catch {
          return false;
        }
      }

      return Object.keys(localStorage).some(key => {
        if (/^sb-[^-]+-auth-token$/.test(key)) {
          const value = localStorage.getItem(key);
          if (!value) return false;
          try {
            const parsed = JSON.parse(value);
            return !!parsed?.access_token || !!parsed?.accessToken;
          } catch {
            return true;
          }
        }
        return false;
      });
    },
    { timeout }
  );
}

/**
 * Logout from the application
 * @param {Page} page - Playwright page object
 */
export async function logout(page) {
  // Try to click logout button if visible
  const logoutBtn = await page.locator('[data-testid="logout-btn"], button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Log out")').first();
  
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  } else {
    // Fallback if no button is found
    await page.goto('/auth');
  }

  // FORCE clear local storage regardless of how we logged out. 
  // This guarantees isAuthenticated() will return false.
  await page.evaluate(() => {
    // Clear Supabase specific keys
    localStorage.removeItem('sb-auth');
    for (const key of Object.keys(localStorage)) {
      if (/^sb-[^-]+-auth-token$/.test(key)) {
        localStorage.removeItem(key);
      }
    }
  });
  
  // Verify redirected to auth page
  await page.waitForURL(/\/auth/);
}

/**
 * Create a custom context with authenticated session
 * @param {Browser} browser - Playwright browser
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{context: BrowserContext, page: Page, token: string}>}
 */
export async function createAuthenticatedContext(browser, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const token = await login(page, email, password);
  
  return { context, page, token };
}

/**
 * Check if user is authenticated
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(page) {
  const token = await getStoredToken(page);
  return !!token;
}

/**
 * Get current user info from the page (if available)
 * @param {Page} page - Playwright page object
 * @returns {Promise<{email: string, role: string} | null>}
 */
export async function getCurrentUser(page) {
  return page.evaluate(() => {
    // Try to extract from various possible locations
    const userEl = document.querySelector('[data-testid="user-email"], [data-user-email]');
    if (userEl) {
      return {
        email: userEl.textContent,
        role: document.querySelector('[data-user-role]')?.textContent || 'unknown'
      };
    }
    return null;
  });
}

/**
 * Get authorization header for API requests
 * @param {Page} page - Playwright page object
 * @returns {Promise<{Authorization: string} | {}>}
 */
export async function getAuthHeaders(page) {
  const token = await getStoredToken(page);
  if (!token) return {};
  
  return {
    Authorization: `Bearer ${token}`
  };
}
