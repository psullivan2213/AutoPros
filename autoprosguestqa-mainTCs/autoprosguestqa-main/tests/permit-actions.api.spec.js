/**
 * Permit Actions - API Layer Tests
 * Covers authentication, RBAC, input validation, state transitions, audit trails, dual-write
 * Tests: 1a-1f from requirements (permit-actions.api.spec.js)
 */

import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth.js';
import { callPermitAction, makeUnauthenticatedRequest, makeRequestWithToken } from './fixtures/api.js';
import { createTestPermit, getPermit, cleanupTestData, seedTestData } from './fixtures/db.js';
import { buildPermitActionPayload, buildPermit } from './utils/test-data.js';
import { assertPermitStatus, assertPermitAudit, assertApiError, assertApiSuccess } from './utils/assertions.js';

test.describe('Permit Actions - API: Authentication (1a)', () => {
  let testData = {};

  test.beforeAll(async () => {
    // Seed test permits for this describe block
    testData = await seedTestData({
      permits: [
        { plate: 'TEST-AUTH-1', status: 'active' },
        { plate: 'TEST-AUTH-2', status: 'active' },
        { plate: 'TEST-AUTH-3', status: 'active' }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData(testData);
  });

  test('A1: No Authorization header returns 401', async ({ page }) => {
    const permitId = testData.permits[0];
    const payload = buildPermitActionPayload('revoke', { permit_id: permitId });

    const response = await page.request.post(
      `${process.env.APP_URL || 'https://real-connections-craft.lovable.app'}/api/permit-action`,
      { data: payload }
    );

    expect(response.status()).toBe(401);
  });

  test('A2: Invalid/Expired JWT returns 401', async ({ page }) => {
    const permitId = testData.permits[1];
    const payload = buildPermitActionPayload('revoke', { permit_id: permitId });
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';

    const response = await page.request.post(
      `${process.env.APP_URL || 'https://real-connections-craft.lovable.app'}/api/permit-action`,
      {
        data: payload,
        headers: { Authorization: `Bearer ${invalidToken}` }
      }
    );

    expect(response.status()).toBe(401);
  });

  test('A3: Valid JWT, no role assigned returns 403 on restricted actions', async ({ page }) => {
    const permitId = testData.permits[2];
    const payload = buildPermitActionPayload('revoke', { permit_id: permitId });
    
    // Login as driver (default role)
    const email = process.env.TEST_DRIVER_EMAIL;
    const password = process.env.TEST_DRIVER_PASSWORD;
    await page.goto('/auth');
    
    const driverPage = await page.context().newPage();
    await login(driverPage, email, password);

    const response = await callPermitAction(driverPage, permitId, 'revoke', {});

    expect(response.status).toBe(403);
    await driverPage.close();
  });
});

test.describe('Permit Actions - API: RBAC (1a continued)', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      permits: [
        { plate: 'TEST-RBAC-1', status: 'active' },
        { plate: 'TEST-RBAC-2', status: 'active' }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData(testData);
  });

  test('A4: Driver role calling revoke returns 403', async ({ page }) => {
    const permitId = testData.permits[0];
    const email = process.env.TEST_DRIVER_EMAIL;
    const password = process.env.TEST_DRIVER_PASSWORD;
    
    await page.goto('/auth');
    const driverPage = await page.context().newPage();
    await login(driverPage, email, password);

    const response = await callPermitAction(driverPage, permitId, 'revoke', {});

    expect(response.status).toBe(403);
    await driverPage.close();
  });

  test('A5: Driver role calling towed returns 200', async ({ page }) => {
    const permitId = testData.permits[1];
    const email = process.env.TEST_DRIVER_EMAIL;
    const password = process.env.TEST_DRIVER_PASSWORD;
    
    await page.goto('/auth');
    const driverPage = await page.context().newPage();
    await login(driverPage, email, password);

    const response = await callPermitAction(driverPage, permitId, 'towed', {
      tow_reason: 'Test tow'
    });

    expect(response.status).toBe(200);
    await driverPage.close();
  });

  test('A6: Admin calls every action returns 200', async ({ page }) => {
    const actions = ['revoke', 'reactivate', 'accept', 'towed', 'manual-tow'];
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    const adminPage = await page.context().newPage();
    await login(adminPage, email, password);

    // Seed a fresh permit for each action to avoid state issues
    for (const action of actions) {
      const permit = await createTestPermit({
        plate: `TEST-${action.toUpperCase()}-${Date.now()}`,
        status: action === 'manual-tow' ? 'towed' : 'active'
      });

      let response;
      if (action === 'manual-tow') {
        response = await callPermitAction(adminPage, null, 'manual-tow', {
          plate: permit.plate,
          property_id: permit.property_id
        });
      } else {
        response = await callPermitAction(adminPage, permit.id, action, {});
      }

      expect(response.status).toBe(200);
      await cleanupTestData({ permits: [permit.id] });
    }

    await adminPage.close();
  });
});

test.describe('Permit Actions - API: Input Validation (1b)', () => {
  test('V1: Invalid action returns 400', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, 'permit-123', 'delete', {});

    expect(response.status).toBe(400);
    expect(response.data).toMatch(/invalid|action/i);
  });

  test('V2: Missing permit plate returns 400', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, null, 'manual-tow', {
      vehicle_make: 'Tesla',
      vehicle_model: 'Model 3',
      // Missing plate
    });

    expect(response.status).toBe(400);
  });

  test('V3: Plate with script tags is sanitized', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const maliciousPlate = '<script>alert("xss")</script>';
    const response = await callPermitAction(page, null, 'manual-tow', {
      plate: maliciousPlate,
      property_id: process.env.TEST_PROPERTY_ID,
      vehicle_make: 'Tesla',
      vehicle_model: 'Model 3'
    });

    if (response.status === 200) {
      // Check that the plate was sanitized in the DB
      // Should not contain script tags
      expect(response.data.permit.plate).not.toContain('<script>');
      expect(response.data.permit.plate).toMatch(/^[a-zA-Z0-9]*$/);
    }
  });

  test('V4: Plate > 20 chars is truncated', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const longPlate = 'THISISAVERYLONGPLATETHATEXCEEDSTWENTYCHARS';
    const response = await callPermitAction(page, null, 'manual-tow', {
      plate: longPlate,
      property_id: process.env.TEST_PROPERTY_ID,
      vehicle_make: 'Tesla',
      vehicle_model: 'Model 3'
    });

    if (response.status === 200) {
      expect(response.data.permit.plate.length).toBeLessThanOrEqual(20);
    }
  });

  test('V9: Missing approval_token for revoke returns 400', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await page.request.post(
      `${process.env.APP_URL || 'https://real-connections-craft.lovable.app'}/api/permit-action`,
      {
        data: {
          action: 'revoke',
          permit_id: permit.id
          // Missing approval_token
        }
      }
    );

    expect(response.status()).toBe(400);
    await cleanupTestData({ permits: [permit.id] });
  });

  test('V11: Malformed JSON returns 500', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await page.request.post(
      `${process.env.APP_URL || 'https://real-connections-craft.lovable.app'}/api/permit-action`,
      {
        data: '{invalid json',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Should return 400 or 500
    expect([400, 500]).toContain(response.status());
  });
});

test.describe('Permit Actions - API: State Transitions (1c)', () => {
  test('R1: Revoke active permit changes status to expired', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, permit.id, 'revoke', {
      approval_token: permit.approval_token
    });

    expect(response.status).toBe(200);
    await assertPermitStatus(permit.id, 'expired');
    
    const updated = await getPermit(permit.id);
    expect(updated.expired_at).toBeTruthy();
    
    await cleanupTestData({ permits: [permit.id] });
  });

  test('R2: Revoke already-expired permit updates expired_at', async ({ page }) => {
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const permit = await createTestPermit({
      status: 'expired',
      expired_at: oldDate.toISOString()
    });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const permitBefore = await getPermit(permit.id);
    
    const response = await callPermitAction(page, permit.id, 'revoke', {
      approval_token: permit.approval_token
    });

    expect(response.status).toBe(200);
    
    const permitAfter = await getPermit(permit.id);
    expect(new Date(permitAfter.expired_at)).toBeGreaterThan(new Date(permitBefore.expired_at));
    
    await cleanupTestData({ permits: [permit.id] });
  });

  test('RA1: Reactivate expired permit returns to active', async ({ page }) => {
    const permit = await createTestPermit({
      status: 'expired',
      expired_at: new Date().toISOString()
    });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, permit.id, 'reactivate', {
      approval_token: permit.approval_token
    });

    expect(response.status).toBe(200);
    await assertPermitStatus(permit.id, 'active');
    
    const updated = await getPermit(permit.id);
    // expired_at should be cleared
    expect(updated.expired_at).toBeNull();
    
    await cleanupTestData({ permits: [permit.id] });
  });

  test('AC1: Accept denied permit changes decision to approved', async ({ page }) => {
    const permit = await createTestPermit({
      status: 'denied',
      decision: 'denied'
    });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, permit.id, 'accept', {
      approval_token: permit.approval_token
    });

    expect(response.status).toBe(200);
    
    const updated = await getPermit(permit.id);
    expect(updated.status).toBe('active');
    expect(updated.decision).toBe('approved');
    
    await cleanupTestData({ permits: [permit.id] });
  });

  test('T1: Towed action sets status to towed with timestamp', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, permit.id, 'towed', {
      approval_token: permit.approval_token,
      guest_email: 'test@example.com'
    });

    expect(response.status).toBe(200);
    await assertPermitStatus(permit.id, 'towed');
    
    const updated = await getPermit(permit.id);
    expect(updated.towed_at).toBeTruthy();
    
    await cleanupTestData({ permits: [permit.id] });
  });

  test('MT1: Manual-tow inserts new row with synthetic token', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const uniquePlate = `MANUAL-${Date.now()}`;
    const response = await callPermitAction(page, null, 'manual-tow', {
      plate: uniquePlate,
      property_id: process.env.TEST_PROPERTY_ID,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic'
    });

    expect(response.status).toBe(200);
    expect(response.data.permit).toBeDefined();
    expect(response.data.permit.status).toBe('towed');
    expect(response.data.permit.approval_token).toMatch(/MANUAL/);
  });

  test('E1: Edit action returns 400 not yet implemented', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, permit.id, 'edit', {
      updates: { plate: 'NEWPLATE' }
    });

    // Edit should not be implemented
    expect([400, 501]).toContain(response.status);
    
    await cleanupTestData({ permits: [permit.id] });
  });
});

test.describe('Permit Actions - API: Audit Trail (1d)', () => {
  test('AU1: Audit fields match calling user', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const response = await callPermitAction(page, permit.id, 'revoke', {
      approval_token: permit.approval_token
    });

    expect(response.status).toBe(200);
    
    const updated = await getPermit(permit.id);
    expect(updated.performed_by_name).toBeTruthy();
    expect(updated.performed_by_role).toBe('admin');
    
    await cleanupTestData({ permits: [permit.id] });
  });

  test('AU3: updated_at timestamp changes after action', async ({ page }) => {
    const permit = await createTestPermit({ status: 'active' });
    const originalUpdatedAt = permit.updated_at;
    
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    // Wait a bit to ensure timestamp differs
    await page.waitForTimeout(100);

    const response = await callPermitAction(page, permit.id, 'revoke', {
      approval_token: permit.approval_token
    });

    expect(response.status).toBe(200);
    
    const updated = await getPermit(permit.id);
    expect(new Date(updated.updated_at)).toBeGreaterThan(new Date(originalUpdatedAt));
    
    await cleanupTestData({ permits: [permit.id] });
  });
});


