// security-checks.spec.js
// Tier 4 — Non-Functional: Security Validation (5 tests)
// Validates headers, injection resistance, rate-limiting, and
// that private routes are unreachable without a valid JWT.

import { test, expect } from '@playwright/test';
import { login, getAuthHeaders } from './fixtures/auth.js';
import { callPermitAction, makeUnauthenticatedRequest } from './fixtures/api.js';
import { createTestPermit, cleanupTestData } from './fixtures/db.js';

const APP_URL = process.env.APP_URL;

// ------------------------------------------------------------
// SEC1 — Security response headers on every HTML response
// Checks for the baseline OWASP-recommended headers
// ------------------------------------------------------------
test('SEC1: app serves required security headers', async ({ page }) => {
  const response = await page.goto(`${APP_URL}/auth`);

  // Content-Security-Policy (may be report-only on QA — either counts)
  const csp =
    response.headers()['content-security-policy'] ||
    response.headers()['content-security-policy-report-only'];

  // X-Content-Type-Options must be "nosniff"
  const xcto = response.headers()['x-content-type-options'];

  // X-Frame-Options or CSP frame-ancestors (one is sufficient)
  const xfo           = response.headers()['x-frame-options'];
  const hasFrameGuard = xfo || (csp && csp.includes('frame-ancestors'));

  expect(
    csp,
    'Missing Content-Security-Policy (or report-only) header'
  ).toBeTruthy();

  expect(
    xcto,
    'X-Content-Type-Options must be "nosniff"'
  ).toBe('nosniff');

  expect(
    hasFrameGuard,
    'No clickjacking protection: set X-Frame-Options or CSP frame-ancestors'
  ).toBeTruthy();
});

// ------------------------------------------------------------
// SEC2 — No sensitive data exposed in unauthenticated responses
// The /status endpoint must NOT leak financial or PII fields
// ------------------------------------------------------------
test('SEC2: /status endpoint does not leak sensitive permit fields', async ({ page }) => {
  const SENSITIVE_FIELDS = [
    'stripe',
    'payment',
    'ssn',
    'tax_id',
    'performed_by_id',
    'service_role',
  ];

  // Hit the status endpoint unauthenticated with a probe plate
  const response = await makeUnauthenticatedRequest(page, 'POST', '/status', {
    body: { plate: 'PROBE999', phone: '555-0000' },
  });

  const text = await response.text().catch(() => '');

  for (const field of SENSITIVE_FIELDS) {
    expect(
      text.toLowerCase(),
      `Sensitive field "${field}" found in unauthenticated /status response`
    ).not.toContain(field);
  }
});

// ------------------------------------------------------------
// SEC3 — SQL/NoSQL injection in plate field is sanitised
// The API must return a 400 (validation error) or 404,
// never a 500 (which would indicate an un-handled injection)
// ------------------------------------------------------------
test('SEC3: SQL injection payloads in plate field do not cause 500 errors', async ({ page }) => {
  await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);

  const injectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE permits; --",
    "1; SELECT * FROM profiles",
    '<script>alert(1)</script>',
    '\\x00\\x1a',
  ];

  for (const payload of injectionPayloads) {
    const response = await makeUnauthenticatedRequest(page, 'POST', '/status', {
      body: { plate: payload, phone: '555-0000' },
    });

    expect(
      response.status,
      `Plate injection payload caused ${response.status}: ${payload}`
    ).not.toBe(500);
  }
});

// ------------------------------------------------------------
// SEC4 — Authenticated routes redirect to /auth when no JWT present
// Every protected path should return a redirect (30x) or 401,
// NOT the actual page content
// ------------------------------------------------------------
test('SEC4: protected routes redirect unauthenticated users', async ({ page }) => {
  // Clear any existing session
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const PROTECTED_PATHS = [
    '/permits',
    '/admin',
    '/users',
    '/performance',
    '/properties',
  ];

  for (const path of PROTECTED_PATHS) {
    const response = await page.goto(`${APP_URL}${path}`);

    // Either a redirect happened (final URL is /auth) OR the server returned 401
    const finalUrl = page.url();
    const redirected = finalUrl.includes('/auth') || finalUrl.includes('/login');

    expect(
      redirected || response?.status() === 401,
      `Protected path ${path} is accessible without auth (final URL: ${finalUrl})`
    ).toBe(true);
  }
});

// ------------------------------------------------------------
// SEC5 — Rate limiting on public endpoints
// Rapid-fire requests to /status or /feedback must eventually
// return 429 (Too Many Requests) per the README spec
// ------------------------------------------------------------
test('SEC5: public /status endpoint enforces rate limiting', async ({ page }) => {
  const MAX_BEFORE_LIMIT  = 60;   // allow up to this many before we expect a 429
  const BURST_SIZE        = 80;   // send this many requests
  let   got429            = false;

  const requests = Array.from({ length: BURST_SIZE }, async (_, i) => {
    const response = await makeUnauthenticatedRequest(page, 'POST', '/status', {
      body: { plate: `RLTEST${i}`, phone: '555-0000' },
    });
    if (response.status === 429) got429 = true;
    return response.status;
  });

  const statuses = await Promise.all(requests);
  const count429 = statuses.filter((s) => s === 429).length;

  console.log(
    `SEC5: sent ${BURST_SIZE} requests — got ${count429} rate-limited (429) responses`
  );

  expect(
    got429,
    `Expected at least one 429 after ${BURST_SIZE} rapid requests to /status. ` +
    `All statuses: ${[...new Set(statuses)].join(', ')}`
  ).toBe(true);
});

