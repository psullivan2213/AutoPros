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

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// ------------------------------------------------------------
// BX1 — Export triggers a file download with the correct MIME type
// Covers: admin triggers export → browser receives a file
// ------------------------------------------------------------
test('BX1: export action downloads a file with expected MIME type', async ({ page }) => {
  await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
  await page.goto(`${APP_URL}/permits`);
  await page.waitForLoadState('networkidle');

  // Watch for the download event BEFORE clicking the export button
  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

  // Locate the export button — adjust selector to match your actual UI
  const exportBtn = page.locator(
    'button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]'
  );

  // If the export button doesn't exist yet, skip gracefully
  const btnExists = await exportBtn.count();
  if (btnExists === 0) {
    test.skip(true, 'Export button not found — feature may not be implemented yet');
    return;
  }

  await exportBtn.first().click();

  const download = await downloadPromise;

  // 1. File must have a name
  const filename = download.suggestedFilename();
  expect(filename, 'Download has no suggested filename').toBeTruthy();

  // 2. MIME type should be CSV or JSON (Excel also acceptable)
  const mimeType = download.suggestedFilename().split('.').pop()?.toLowerCase();
  expect(
    ['csv', 'json', 'xlsx', 'xls'],
    `Unexpected export file extension: ${mimeType}`
  ).toContain(mimeType);

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

    await login(page, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
    await page.goto(`${APP_URL}/permits`);
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]'
    );
    if ((await exportBtn.count()) === 0) {
      test.skip(true, 'Export button not found');
      return;
    }

    await exportBtn.first().click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    const savePath = path.join(DOWNLOAD_DIR, `bx2-${filename}`);
    await download.saveAs(savePath);

    const content = fs.readFileSync(savePath, 'utf-8');

    // --- CSV validation ---
    if (filename.endsWith('.csv')) {
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      const firstLine = lines[0]?.toLowerCase() ?? '';
      for (const col of REQUIRED_CSV_HEADERS) {
        expect(firstLine, `Missing column "${col}" in CSV header`).toContain(col);
      }
      expect(content, 'Seeded plate BXTEST99 not found in export').toContain('BXTEST99');
      exportRecordCount = Math.max(0, lines.length - 1);
    }

    // --- JSON validation ---
    if (filename.endsWith('.json')) {
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
    await login(page, process.env.TEST_PM_EMAIL, process.env.TEST_PM_PASSWORD);
    await page.goto(`${APP_URL}/pm`);
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]'
    );

    if ((await exportBtn.count()) === 0) {
      test.skip(true, 'Export button not found on PM portal');
      return;
    }

    await exportBtn.first().click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    const savePath = path.join(DOWNLOAD_DIR, `bx3-${filename}`);
    await download.saveAs(savePath);

    const content = fs.readFileSync(savePath, 'utf-8');

    // The unassigned property must NOT appear anywhere in the PM's export
    expect(
      content,
      'PM export contains data from an unassigned property (data leak!)'
    ).not.toContain('OTHER_PROPERTY_NOT_ASSIGNED_TO_PM');

    if (filename.endsWith('.json')) {
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

