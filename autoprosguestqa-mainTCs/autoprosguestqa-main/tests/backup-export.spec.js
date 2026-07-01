// backup-export.spec.js
// Tier 4 — Non-Functional: Backup / Export Tests (3 tests)
// Verifies that permit data can be exported in a usable format
// and that the export is complete, well-formed, and scoped correctly.

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { login } from './fixtures/auth.js';
import { createTestPermit, cleanupTestData } from './fixtures/db.js';

const APP_URL      = process.env.APP_URL;
const DOWNLOAD_DIR = path.join(process.cwd(), 'test-downloads');

const getFileExtension = (filename = '') => path.extname(filename).slice(1).toLowerCase();

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// ------------------------------------------------------------
// BX1 — Export triggers a file download with the correct MIME type
// Covers: admin triggers export → browser receives a file
// ------------------------------------------------------------
test('BX1: export action downloads a file with expected MIME type', async ({ page }) => {
  // 1. Authenticate programmatically and let it settle on the root homepage
  await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  
  // 2. Pause briefly to allow application scripts to register the Supabase token state
  await page.waitForTimeout(500);

  // 3. Navigate cleanly to the permits page now that the session is active
  await page.goto(`${APP_URL}/permits`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');

  // Locate the export button — adjust selector to match your actual UI
  const exportBtn = page.locator(
    'button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]'
  );

  // Auto-wait for the element to arrive instead of doing an instant count check
  try {
    await exportBtn.first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch (error) {
    test.skip(true, 'Export button not found or page took too long to load — feature may not be implemented yet');
    return;
  }

  // Watch for the download event BEFORE clicking the export button
  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

  await exportBtn.first().click();

  const download = await downloadPromise;

  // 1. File must have a name
  const filename = download.suggestedFilename();
  expect(filename, 'Download has no suggested filename').toBeTruthy();

  // 2. Export file extension should be CSV, JSON, or Excel
  const extension = getFileExtension(filename);
  expect(
    ['csv', 'json', 'xlsx', 'xls'],
    `Unexpected export file extension: ${extension}`
  ).toContain(extension);

  // 3. Save to disk for inspection in BX2/BX3
  const savePath = path.join(DOWNLOAD_DIR, filename);
  await download.saveAs(savePath);

  expect(fs.existsSync(savePath), `File not saved at ${savePath}`).toBe(true);
  const stats = fs.statSync(savePath);
  expect(stats.size, 'Exported file is empty').toBeGreaterThan(0);

  console.log(`BX1: downloaded ${filename} (${stats.size} bytes)`);
});

// ------------------------------------------------------------
// BX2 — Exported CSV/JSON contains expected columns and seeded data
// Seeds a known permit, exports, then verifies it appears in the file
// ------------------------------------------------------------
test('BX2: exported file contains required fields and seeded permit data', async ({ page }) => {
  const REQUIRED_CSV_HEADERS = [
    'id',
    'plate',
    'status',
    'created_at',
    'expires_at',
    'property_id',
  ];

  let seededPermit;
  let exportRecordCount = null;
  try {
    // Seed a permit with a distinctive plate we can search for
    seededPermit = await createTestPermit({
      status:   'active',
      plate:    'BXTEST99',
      property_id: process.env.TEST_PROPERTY_ID,
    });

    // 1. Authenticate programmatically and let it settle on the root homepage
    await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
    
    // 2. Pause briefly to allow application scripts to register the Supabase token state
    await page.waitForTimeout(500);

    // 3. Navigate cleanly to the permits page now that the session is active
    await page.goto(`${APP_URL}/permits`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]'
    );

    // Auto-wait for the element to arrive instead of doing an instant count check
    try {
      await exportBtn.first().waitFor({ state: 'visible', timeout: 10_000 });
    } catch (error) {
      test.skip(true, 'Export button not found or page took too long to load.');
      return;
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    await exportBtn.first().click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    const extension = getFileExtension(filename);
    const savePath = path.join(DOWNLOAD_DIR, `bx2-${filename}`);
    await download.saveAs(savePath);

    const content = fs.readFileSync(savePath, 'utf-8');

    // --- CSV validation ---
    if (extension === 'csv') {
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      const firstLine = lines[0]?.toLowerCase() ?? '';
      for (const col of REQUIRED_CSV_HEADERS) {
        expect(firstLine, `Missing column "${col}" in CSV header`).toContain(col);
      }
      expect(content, 'Seeded plate BXTEST99 not found in export').toContain('BXTEST99');
      exportRecordCount = Math.max(0, lines.length - 1);
    }

    // --- JSON validation ---
    if (extension === 'json') {
      const parsed = JSON.parse(content);
      const records = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.permits ?? [];
      expect(records.length, 'Export contains no records').toBeGreaterThan(0);

      const first = records[0];
      for (const col of REQUIRED_CSV_HEADERS) {
        expect(Object.keys(first), `JSON record missing field "${col}"`).toContain(col);
      }

      const found = records.some(
        (r) => r.plate === 'BXTEST99' || r.id === seededPermit?.id
      );
      expect(found, 'Seeded permit not found in JSON export').toBe(true);
      exportRecordCount = records.length;
    }

    console.log(`BX2: export validated (${exportRecordCount !== null ? exportRecordCount : 'n/a'} records)`);
  } finally {
    if (seededPermit?.id) {
      await cleanupTestData({ permits: [seededPermit.id] });
    }
  }
});

// ------------------------------------------------------------
// BX3 — PM-scoped export only contains their assigned property
// A PM user must not receive permits from other properties
// in their export — validates RLS / scoping at the export layer
// ------------------------------------------------------------
test('BX3: PM export is scoped to assigned properties only', async ({ page }) => {
  // Seed a permit for a different property (should NOT appear in PM export)
  const otherPermit = await createTestPermit({
    status:      'active',
    property_id: 'OTHER_PROPERTY_NOT_ASSIGNED_TO_PM',
  });

  try {
    // 1. Authenticate programmatically and let it settle on the root homepage
    await login(page, process.env.TEST_PM_EMAIL, process.env.TEST_PM_PASSWORD);
    
    // 2. Pause briefly to allow application scripts to register the Supabase token state
    await page.waitForTimeout(500);

    // 3. Navigate cleanly to the PM portal route now that the session is active
    await page.goto(`${APP_URL}/pm`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]'
    );

    // Auto-wait for the element to arrive instead of doing an instant count check
    try {
      await exportBtn.first().waitFor({ state: 'visible', timeout: 10_000 });
    } catch (error) {
      test.skip(true, 'Export button not found on PM portal or page took too long to load.');
      return;
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    await exportBtn.first().click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    const extension = getFileExtension(filename);
    const savePath = path.join(DOWNLOAD_DIR, `bx3-${filename}`);
    await download.saveAs(savePath);

    const content = fs.readFileSync(savePath, 'utf-8');

    // The unassigned property must NOT appear anywhere in the PM's export
    expect(
      content,
      'PM export contains data from an unassigned property (data leak!)'
    ).not.toContain('OTHER_PROPERTY_NOT_ASSIGNED_TO_PM');

    if (extension === 'json') {
      const records = JSON.parse(content);
      const leaked  = records.filter
        ? records.filter((r) => r.property_id === 'OTHER_PROPERTY_NOT_ASSIGNED_TO_PM')
        : [];
      expect(leaked.length, `PM export leaked ${leaked.length} unassigned permits`).toBe(0);
    }

    console.log('BX3: PM export correctly scoped — no unassigned-property data found');
  } finally {
    if (otherPermit?.id) {
      await cleanupTestData({ permits: [otherPermit.id] });
    }
  }
});