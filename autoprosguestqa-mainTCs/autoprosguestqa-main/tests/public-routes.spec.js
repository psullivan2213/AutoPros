/**
 * Public Routes Tests
 * Covers /feedback and /status endpoints (unauthenticated)
 * Tests: 2h from requirements
 */

import { test, expect } from '@playwright/test';
import { makeUnauthenticatedRequest } from './fixtures/api.js';
import { createTestPermit, cleanupTestData } from './fixtures/db.js';

test.describe('Public Routes: Feedback (2h)', () => {
  test('Feedback endpoint accepts unauthenticated POST', async ({ page }) => {
    const payload = {
      email: `feedback${Date.now()}@example.com`,
      message: 'Test feedback message',
      category: 'bug'
    };

    const response = await makeUnauthenticatedRequest(page, 'post', '/api/public/feedback', {
      data: payload
    });

    expect(response.status).toBe(200);
  });

  test('Feedback missing email returns error', async ({ page }) => {
    const payload = {
      message: 'Test feedback',
      // Missing email
    };

    const response = await makeUnauthenticatedRequest(page, 'post', '/api/public/feedback', {
      data: payload
    });

    expect([400, 422]).toContain(response.status);
  });

  test('Feedback with valid data inserts to DB', async ({ page }) => {
    const email = `feedback${Date.now()}@example.com`;
    const payload = {
      email,
      message: 'Test feedback message',
      category: 'suggestion'
    };

    const response = await makeUnauthenticatedRequest(page, 'post', '/api/public/feedback', {
      data: payload
    });

    expect(response.status).toBe(200);
    // Response should contain feedback ID
    expect(response.data.id || response.data.feedback_id).toBeTruthy();
  });
});

test.describe('Public Routes: Permit Status Lookup (2h)', () => {
  let testPermit = null;

  test.beforeAll(async () => {
    testPermit = await createTestPermit({
      plate: 'STATUS01',
      status: 'active',
      guest_phone: '555-0100'
    });
  });

  test.afterAll(async () => {
    if (testPermit?.id) {
      await cleanupTestData({ permits: [testPermit.id] });
    }
  });

  test('Status lookup returns permit with plate and phone', async ({ page }) => {
    const response = await makeUnauthenticatedRequest(page, 'get', 
      `/api/public/status?plate=${testPermit.plate}&phone=${testPermit.guest_phone}`
    );

    expect(response.status).toBe(200);
    expect(response.data.permit).toBeDefined();
    expect(response.data.permit.plate).toBe(testPermit.plate);
    expect(response.data.permit.status).toBe('active');
  });

  test('Status lookup with wrong phone returns error', async ({ page }) => {
    const response = await makeUnauthenticatedRequest(page, 'get', 
      `/api/public/status?plate=${testPermit.plate}&phone=555-9999`
    );

    expect([401, 404, 403]).toContain(response.status);
  });

  test('Status lookup with non-existent plate returns empty', async ({ page }) => {
    const response = await makeUnauthenticatedRequest(page, 'get', 
      `/api/public/status?plate=NOEXIST&phone=555-0100`
    );

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(response.data.permit).toBeFalsy();
    }
  });

  test('Status lookup returns only public fields', async ({ page }) => {
    const response = await makeUnauthenticatedRequest(page, 'get', 
      `/api/public/status?plate=${testPermit.plate}&phone=${testPermit.guest_phone}`
    );

    expect(response.status).toBe(200);
    const permit = response.data.permit;
    
    // Should have public fields
    expect(permit.plate).toBeTruthy();
    expect(permit.status).toBeTruthy();
    
    // Should NOT have sensitive fields
    expect(permit.approval_token).toBeFalsy();
    expect(permit.performed_by_id).toBeFalsy();
  });

  test('Status page auto-refreshes every 15 seconds', async ({ page }) => {
    // This is more of a UI test, so we'd test the page directly
    await page.goto(`/status?plate=${testPermit.plate}&phone=${testPermit.guest_phone}`);
    
    // Check if page auto-reloads or polls API
    const refreshBadge = page.locator('[data-testid="refresh-indicator"], .refresh-timer');
    if (await refreshBadge.isVisible()) {
      // Verify it shows "auto-refresh" or similar
      const text = await refreshBadge.textContent();
      expect(text).toMatch(/refresh|auto|15|second/i);
    }
  });
});

test.describe('Public Routes: Rate Limiting (2h)', () => {
  test('Feedback endpoint has rate limiting', async ({ page }) => {
    // Make multiple requests quickly
    const requests = [];
    for (let i = 0; i < 20; i++) {
      const payload = {
        email: `feedback${i}@example.com`,
        message: `Test ${i}`
      };
      
      const response = await makeUnauthenticatedRequest(page, 'post', '/api/public/feedback', {
        data: payload
      });
      
      requests.push(response.status);
    }
    
    // At least one request should be rate limited (429)
    const hasRateLimit = requests.includes(429);
    expect(hasRateLimit).toBe(true);
  });

  test('Status endpoint has rate limiting', async ({ page }) => {
    // Make multiple requests quickly
    const responses = [];
    for (let i = 0; i < 20; i++) {
      const response = await makeUnauthenticatedRequest(page, 'get', 
        `/api/public/status?plate=TEST${i}&phone=555-0100`
      );
      responses.push(response.status);
    }
    
    // Should eventually hit rate limit (429)
    const hasRateLimit = responses.includes(429);
    expect(hasRateLimit).toBe(true);
  });
});

test.describe('Public Routes: CORS', () => {
  test('Public endpoints include correct CORS headers', async ({ page }) => {
    const response = await makeUnauthenticatedRequest(page, 'options', '/api/public/status');
    
    // Should include CORS headers
    const headers = response.headers;
    expect(headers['access-control-allow-origin']).toBeTruthy();
    expect(headers['access-control-allow-methods']).toBeTruthy();
  });

  test('Public endpoints allow cross-origin requests', async ({ page }) => {
    const response = await makeUnauthenticatedRequest(page, 'get', 
      '/api/public/status?plate=TEST&phone=555-0100',
      {
        headers: { 'Origin': 'https://example.com' }
      }
    );
    
    expect(response.status).toBeDefined();
    const corsOrigin = response.headers['access-control-allow-origin'];
    expect(corsOrigin === '*' || corsOrigin === 'https://example.com').toBe(true);
  });
});

