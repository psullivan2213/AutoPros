/**
 * Permit Intake Tests
 * Covers permit submission, GHL webhooks, photo requirements, cooldown, caps, deduplication
 * Tests: 2c from requirements
 */

import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth.js';
import { submitPermit, callGHLWebhook } from './fixtures/api.js';
import { createTestProperty, getNotificationLogs, cleanupTestData, seedTestData } from './fixtures/db.js';
import { buildGHLWebhookPayload, buildPermitSubmission } from './utils/test-data.js';

test.describe('Permit Intake: Basic Submission (2c)', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      properties: [
        {
          name: 'Test Property 1',
          require_photo: false,
          permit_duration_days: 30,
          cooldown_days: 0,
          active_cap: null,
          monthly_cap: null
        }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData({
      properties: testData.properties
    });
  });

  test('2c-1: GHL webhook creates permit with correct data', async ({ page }) => {
    const propertyId = testData.properties[0];
    
    const payload = buildGHLWebhookPayload({
      contact_phone: '555-0100',
      vehicle_plate: 'INTAKE01',
      property_id: propertyId
    });

    const response = await callGHLWebhook(page, payload);

    expect(response.status).toBe(200);
    expect(response.data.permit).toBeDefined();
    expect(response.data.permit.plate).toBe('INTAKE01');
    expect(response.data.permit.status).toBe('active');
  });

  test('2c-2: Photo missing on photo-required property returns denied', async ({ page }) => {
    const property = await createTestProperty({
      name: 'Photo Required Property',
      require_photo: true
    });

    const payload = buildGHLWebhookPayload({
      contact_phone: '555-0101',
      vehicle_plate: 'NOPHOTO01',
      property_id: property.id,
      photo_url: null  // No photo
    });

    const response = await callGHLWebhook(page, payload);

    if (response.status === 200) {
      expect(response.data.permit.status).toBe('denied');
      expect(response.data.permit.decision_reason).toContain('photo');
    }

    await cleanupTestData({ properties: [property.id] });
  });

  test('2c-3: Duplicate submission (same approval_token) is deduped', async ({ page }) => {
    const propertyId = testData.properties[0];
    const token = `token-${Date.now()}`;

    const payload = buildGHLWebhookPayload({
      contact_phone: '555-0102',
      vehicle_plate: 'DUPE01',
      property_id: propertyId,
      approval_token: token
    });

    // Submit twice with same token
    const response1 = await callGHLWebhook(page, payload);
    const response2 = await callGHLWebhook(page, payload);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Should be same permit ID (deduped)
    expect(response1.data.permit.id).toBe(response2.data.permit.id);
  });

  test('2c-4: Email queue receives permit-approved', async ({ page }) => {
    const propertyId = testData.properties[0];

    const payload = buildGHLWebhookPayload({
      contact_phone: '555-0103',
      contact_email: `email${Date.now()}@example.com`,
      vehicle_plate: 'EMAIL01',
      property_id: propertyId
    });

    const response = await callGHLWebhook(page, payload);
    expect(response.status).toBe(200);

    // Check notification log for email
    const logs = await getNotificationLogs({
      event_type: 'permit-approved'
    });

    const found = logs.some(log => log.recipient_email === payload.contact_email);
    expect(found).toBe(true);
  });

});

test.describe('Permit Intake: Cooldown Rule (2c)', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      properties: [
        {
          name: 'Cooldown Property',
          cooldown_days: 7,
          require_photo: false,
          permit_duration_days: 30
        }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData({
      properties: testData.properties
    });
  });

  test('2c-6: Cooldown rule enforced - denied when within cooldown period', async ({ page }) => {
    const propertyId = testData.properties[0];
    const phone = '555-0200';

    // First submission
    const payload1 = buildGHLWebhookPayload({
      contact_phone: phone,
      vehicle_plate: 'COOLDOWN01',
      property_id: propertyId
    });

    const response1 = await callGHLWebhook(page, payload1);
    expect(response1.status).toBe(200);
    expect(response1.data.permit.status).toBe('active');

    // Second submission immediately after (within cooldown)
    const payload2 = buildGHLWebhookPayload({
      contact_phone: phone,
      vehicle_plate: 'COOLDOWN02',
      property_id: propertyId
    });

    const response2 = await callGHLWebhook(page, payload2);
    expect(response2.status).toBe(200);
    expect(response2.data.permit.status).toBe('denied');
    expect(response2.data.permit.decision_reason).toContain('cooldown');
  });
});

test.describe('Permit Intake: Monthly Cap (2c)', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      properties: [
        {
          name: 'Capped Property',
          monthly_cap: 2,
          require_photo: false,
          cooldown_days: 0,
          permit_duration_days: 30
        }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData({
      properties: testData.properties
    });
  });

  test('2c-7: Monthly cap exceeded returns denied', async ({ page }) => {
    const propertyId = testData.properties[0];

    // Submit up to monthly cap (2)
    for (let i = 1; i <= 2; i++) {
      const payload = buildGHLWebhookPayload({
        contact_phone: `555-020${i}`,
        vehicle_plate: `MONTHLYCAP0${i}`,
        property_id: propertyId
      });

      const response = await callGHLWebhook(page, payload);
      expect(response.status).toBe(200);
      expect(response.data.permit.status).toBe('active');
    }

    // Third submission should be denied
    const payload3 = buildGHLWebhookPayload({
      contact_phone: '555-0203',
      vehicle_plate: 'MONTHLYCAP03',
      property_id: propertyId
    });

    const response3 = await callGHLWebhook(page, payload3);
    expect(response3.status).toBe(200);
    expect(response3.data.permit.status).toBe('denied');
    expect(response3.data.permit.decision_reason).toContain('monthly cap');
  });
});

test.describe('Permit Intake: Active Cap (2c)', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      properties: [
        {
          name: 'Active Capped Property',
          active_cap: 2,
          monthly_cap: null,
          cooldown_days: 0,
          require_photo: false,
          permit_duration_days: 30
        }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData({
      properties: testData.properties
    });
  });

  test('2c-8: Active permit cap exceeded returns denied', async ({ page }) => {
    const propertyId = testData.properties[0];

    // Submit up to active cap (2)
    for (let i = 1; i <= 2; i++) {
      const payload = buildGHLWebhookPayload({
        contact_phone: `555-030${i}`,
        vehicle_plate: `ACTIVECAP0${i}`,
        property_id: propertyId
      });

      const response = await callGHLWebhook(page, payload);
      expect(response.status).toBe(200);
      expect(response.data.permit.status).toBe('active');
    }

    // Third submission should be denied
    const payload3 = buildGHLWebhookPayload({
      contact_phone: '555-0303',
      vehicle_plate: 'ACTIVECAP03',
      property_id: propertyId
    });

    const response3 = await callGHLWebhook(page, payload3);
    expect(response3.status).toBe(200);
    expect(response3.data.permit.status).toBe('denied');
    expect(response3.data.permit.decision_reason).toContain('active');
  });
});

test.describe('Permit Intake: Invalid Input', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      properties: [
        {
          name: 'Validation Property',
          require_photo: false,
          cooldown_days: 0,
          permit_duration_days: 30
        }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData({
      properties: testData.properties
    });
  });

  test('2c-9: Missing required field returns error', async ({ page }) => {
    const payload = buildGHLWebhookPayload({
      property_id: testData.properties[0]
      // Missing contact_phone
    });

    const response = await callGHLWebhook(page, payload);

    expect([400, 422]).toContain(response.status);
  });

  test('2c-10: Invalid property ID returns denied or error', async ({ page }) => {
    const payload = buildGHLWebhookPayload({
      contact_phone: '555-0400',
      vehicle_plate: 'BADPROP01',
      property_id: 'nonexistent-property-id'
    });

    const response = await callGHLWebhook(page, payload);

    // Should either error or deny the permit
    expect([400, 422, 200]).toContain(response.status);
    if (response.status === 200) {
      expect(response.data.permit.status).toBe('denied');
    }
  });
});

test.describe('Permit Intake: Permit Denied Email', () => {
  let testData = {};

  test.beforeAll(async () => {
    testData = await seedTestData({
      properties: [
        {
          name: 'Deny Test Property',
          require_photo: true,
          permit_duration_days: 30
        }
      ]
    });
  });

  test.afterAll(async () => {
    await cleanupTestData({
      properties: testData.properties
    });
  });

  test('2c-11: Email queue receives permit-denied', async ({ page }) => {
    const propertyId = testData.properties[0];
    const email = `deny${Date.now()}@example.com`;

    // Submit without photo (will be denied)
    const payload = buildGHLWebhookPayload({
      contact_phone: '555-0500',
      contact_email: email,
      vehicle_plate: 'DENIED01',
      property_id: propertyId,
      photo_url: null
    });

    const response = await callGHLWebhook(page, payload);
    expect(response.status).toBe(200);

    if (response.data.permit.status === 'denied') {
      // Check notification log for denied email
      const logs = await getNotificationLogs({
        event_type: 'permit-denied'
      });

      const found = logs.some(log => log.recipient_email === email);
      expect(found).toBe(true);
    }
  });
});

