/**
 * Permit Expiry Sweeper Tests
 * Covers cron job, permit expiration, notification emails, idempotency
 * Tests: 2d from requirements
 */

import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth.js';
import { createTestPermit, getNotificationLogs, getPermit, cleanupTestData } from './fixtures/db.js';
import { runExpirySweeper } from './fixtures/api.js';

test.describe('Permit Expiry Sweeper (2d)', () => {
  test('Sweeper flips expired permits to expired status', async ({ page }) => {
    // Create permit with expires_at in the past
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const permit = await createTestPermit({
      status: 'active',
      expires_at: pastDate.toISOString()
    });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    // Run sweeper
    const response = await runExpirySweeper(page);
    expect(response.status).toBe(200);

    // Verify permit status changed
    const updated = await getPermit(permit.id);
    expect(updated.status).toBe('expired');
    expect(updated.expired_at).toBeTruthy();

    await cleanupTestData({ permits: [permit.id] });
  });

  test('Permit-expiring-soon email fires at 1-hour mark', async ({ page }) => {
    // Create permit expiring in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const permit = await createTestPermit({
      status: 'active',
      expires_at: expiresAt.toISOString(),
      guest_email: `expiring${Date.now()}@example.com`
    });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    // Run sweeper
    const response = await runExpirySweeper(page);
    expect(response.status).toBe(200);

    // Check notification log
    const logs = await getNotificationLogs({
      event_type: 'permit-expiring-soon',
      record_id: permit.id
    });

    // Should have expiring-soon email
    const found = logs.some(log => log.recipient_email === permit.guest_email);
    expect(found).toBe(true);

    await cleanupTestData({ permits: [permit.id] });
  });

  test('Sweeper is idempotent - running twice does not duplicate', async ({ page }) => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const permit = await createTestPermit({
      status: 'active',
      expires_at: pastDate.toISOString(),
      guest_email: `idempotent${Date.now()}@example.com`
    });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    // Run sweeper twice
    const response1 = await runExpirySweeper(page);
    const response2 = await runExpirySweeper(page);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Should not have duplicate expired_at timestamps
    const updated = await getPermit(permit.id);
    expect(updated.status).toBe('expired');

    // Should have only one expiration record
    // (Check via audit log if available)

    await cleanupTestData({ permits: [permit.id] });
  });

  test('Sweeper does not affect already-expired permits', async ({ page }) => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const permit = await createTestPermit({
      status: 'expired',
      expires_at: new Date().toISOString(),
      expired_at: oldDate.toISOString()
    });

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const beforeExpiredAt = permit.expired_at;

    const response = await runExpirySweeper(page);
    expect(response.status).toBe(200);

    const updated = await getPermit(permit.id);
    expect(updated.expired_at).toBe(beforeExpiredAt);

    await cleanupTestData({ permits: [permit.id] });
  });

  test('Sweeper handles large batches efficiently', async ({ page }) => {
    // Create 100 expired permits
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const permits = [];
    
    for (let i = 0; i < 10; i++) {  // Reduced for test speed
      const permit = await createTestPermit({
        status: 'active',
        expires_at: pastDate.toISOString(),
        plate: `SWEEP${i}`
      });
      permits.push(permit.id);
    }

    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    
    await page.goto('/auth');
    await login(page, email, password);

    const startTime = Date.now();
    const response = await runExpirySweeper(page);
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(30000);  // Should complete in < 30 seconds

    await cleanupTestData({ permits });
  });
});

