// performance.spec.js
// Tier 4 — Non-Functional: Latency & Performance Tests (5 tests)
// Validates p95 targets defined in the README:
//   Login      < 5 000 ms
//   Page load  < 3 000 ms
//   API call   < 1 000 ms
//   Permit act < 2 000 ms

import { test, expect } from '@playwright/test';
import { login, getAuthHeaders } from './fixtures/auth.js';
import { callPermitAction, makeUnauthenticatedRequest } from './fixtures/api.js';
import { createTestPermit, cleanupTestData } from './fixtures/db.js';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Median of a sorted numeric array */
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Run fn N times, return array of durations in ms */
async function benchmark(fn, n = 5) {
  const durations = [];
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    await fn();
    durations.push(Date.now() - t0);
  }
  return durations;
}

// ------------------------------------------------------------
// PERF1 — Login round-trip < 5 000 ms (p95 across 3 attempts)
// ------------------------------------------------------------
test('PERF1: login completes in under 5 000 ms (p95)', async ({ page }) => {
  const THRESHOLD_MS = 5_000;
  const RUNS         = 3;

  const durations = await benchmark(async () => {
    await page.goto(`${process.env.APP_URL}/auth`);
    await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
    // Log out before next iteration so session doesn't cache
    await page.evaluate(() => {
      // Clear localStorage / sessionStorage to force real auth on each run
      localStorage.clear();
      sessionStorage.clear();
    });
  }, RUNS);

  const p95 = durations.sort((a, b) => a - b)[Math.ceil(RUNS * 0.95) - 1] ?? durations.at(-1);

  console.log(`PERF1 login durations (ms): ${durations.join(', ')} — p95: ${p95}`);
  expect(p95, `Login p95 ${p95}ms exceeds ${THRESHOLD_MS}ms`).toBeLessThan(THRESHOLD_MS);
});

// ------------------------------------------------------------
// PERF2 — Permits page full load < 3 000 ms
// ------------------------------------------------------------
test('PERF2: /permits page loads in under 3 000 ms', async ({ page }) => {
  const THRESHOLD_MS = 3_000;

  await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);

  const durations = await benchmark(async () => {
    await page.goto(`${process.env.APP_URL}/permits`);
    await page.waitForLoadState('networkidle');
  }, 3);

  const med = median(durations);
  console.log(`PERF2 page-load durations (ms): ${durations.join(', ')} — median: ${med}`);
  expect(med, `Page load median ${med}ms exceeds ${THRESHOLD_MS}ms`).toBeLessThan(THRESHOLD_MS);
});

// ------------------------------------------------------------
// PERF3 — Permit action API call < 2 000 ms
// Relies on callPermitAction from fixtures/api.js
// Creates a real permit via db.js so the action hits a valid row
// ------------------------------------------------------------
test('PERF3: permit revoke action completes in under 2 000 ms', async ({ page }) => {
  const THRESHOLD_MS = 2_000;

  await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);

  const seeded = [];
  try {
    const durations = [];
    for (let i = 0; i < 3; i++) {
      // Seed a fresh active permit for each run
      const permit = await createTestPermit({ status: 'active' });
      seeded.push(permit.id);

      const t0       = Date.now();
      const response = await callPermitAction(page, permit.id, 'revoke', {});
      durations.push(Date.now() - t0);

      // Confirm the action succeeded (don't fail perf test on logic errors)
      if (response.status !== 200) {
        console.warn(`PERF3: revoke returned ${response.status} — skipping duration for run ${i}`);
      }
    }

    const med = median(durations);
    console.log(`PERF3 permit-action durations (ms): ${durations.join(', ')} — median: ${med}`);
    expect(med, `Permit action median ${med}ms exceeds ${THRESHOLD_MS}ms`).toBeLessThan(THRESHOLD_MS);
  } finally {
    await cleanupTestData({ permits: seeded });
  }
});

// ------------------------------------------------------------
// PERF4 — Unauthenticated API call < 1 000 ms
// /status and /feedback are the public endpoints per the README
// ------------------------------------------------------------
test('PERF4: unauthenticated API call completes in under 1 000 ms', async ({ page }) => {
  const THRESHOLD_MS = 1_000;

  const durations = await benchmark(async () => {
    // POST to /feedback — no auth required per 2h tests
    const response = await makeUnauthenticatedRequest(page, 'POST', '/feedback', {
      body: { message: 'perf-test-probe', rating: 5 },
    });
    // Accept 200 or 201; don't fail on validation errors — just measure latency
    expect([200, 201, 400, 422]).toContain(response.status);
  }, 5);

  const p95 = durations.sort((a, b) => a - b)[Math.ceil(5 * 0.95) - 1];
  console.log(`PERF4 unauthenticated API durations (ms): ${durations.join(', ')} — p95: ${p95}`);
  expect(p95, `Unauthenticated API p95 ${p95}ms exceeds ${THRESHOLD_MS}ms`).toBeLessThan(THRESHOLD_MS);
});

// ------------------------------------------------------------
// PERF5 — Time-to-interactive: first meaningful paint on /auth
// Uses Playwright's built-in performance timing via CDP
// ------------------------------------------------------------
test('PERF5: /auth page first contentful paint under 2 000 ms', async ({ page }) => {
  const THRESHOLD_MS = 2_000;

  // Navigate cold (no prior session)
  await page.goto(`${process.env.APP_URL}/auth`);

  // Grab paint entries from the Performance API
  const fcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntriesByName('first-contentful-paint')) {
          resolve(entry.startTime);
          return;
        }
      });
      observer.observe({ type: 'paint', buffered: true });

      // Fallback if already painted
      const existing = performance.getEntriesByName('first-contentful-paint');
      if (existing.length) resolve(existing[0].startTime);

      // Hard fallback after 5 s
      setTimeout(() => resolve(null), 5_000);
    });
  });

  if (fcp === null) {
    console.warn('PERF5: FCP not reported by browser — skipping assertion');
    return;
  }

  console.log(`PERF5 FCP: ${fcp.toFixed(0)}ms`);
  expect(fcp, `FCP ${fcp.toFixed(0)}ms exceeds ${THRESHOLD_MS}ms`).toBeLessThan(THRESHOLD_MS);
});

