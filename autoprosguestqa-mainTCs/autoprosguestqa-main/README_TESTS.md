# Permit Lifecycle Testing Suite

Comprehensive Playwright test suite for the AutoPros Permit Management System, covering authentication, RBAC, permit lifecycle actions, email notifications, and more.

## 📋 Overview

This test suite includes **150+ tests** organized into **3 tiers** and **4 layers**:

### Test Tiers
- **Tier 1 (Critical Path)**: Auth, RBAC, API-layer permit actions, permit intake, smoke test
- **Tier 2 (High Value)**: PM portal, public routes, email system
- **Tier 3 (Features)**: Permits page, properties, expiry sweeper, UI actions
- **Tier 4 (Non-Functional)**: Mobile responsive, performance, security, backup export

### Test Files
```
tests/
├── fixtures/               # Test utilities & helpers
│   ├── auth.js            # Login, session management
│   ├── db.js              # Supabase service role client
│   ├── api.js             # HTTP client for API calls
│   └── webhook.js         # Webhook spying & mocking
├── utils/
│   ├── test-data.js       # Data factories & builders
│   └── assertions.js      # Common assertions
├── auth.spec.js           # Authentication tests (8 tests)
├── rbac.spec.js           # RBAC tests (20+ tests)
├── permit-actions.api.spec.js    # API permit actions (50+ tests)
├── permit-actions.ui.spec.js     # UI permit actions (20 tests)
├── permit-intake.spec.js         # Permit submission (15+ tests)
├── permit-expiry-sweeper.spec.js # Expiry cron job (5 tests)
├── permits-page.spec.js          # Filtering, search, pagination (15 tests)
├── properties.spec.js            # Property management (10 tests)
├── pm-portal.spec.js             # PM-specific features (12+ tests)
├── public-routes.spec.js         # Unauthenticated endpoints (15+ tests)
├── emails.spec.js                # Email system (20+ tests)
├── smoke.spec.js                 # End-to-end happy path (10 tests)
├── mobile-responsive.spec.js     # Mobile viewport tests (10 tests)
├── performance.spec.js           # Latency tests (5 tests)
├── security-checks.spec.js       # Security validation (5 tests)
└── backup-export.spec.js         # Backup/export tests (3 tests)
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy and edit `.env.test` with your credentials:
```bash
cp .env.test .env.test.local
# Edit with Supabase URL, keys, test user accounts, webhook URL, etc.
```

### 3. Run Tests
```bash
# All tests
npm test

# Specific tier
npm run test:tier1    # Critical path (fastest)
npm run test:tier2    # High value features
npm run test:tier3    # Feature coverage

# Specific test file
npm run test:auth     # Only auth tests

# Interactive mode
npm run test:ui       # Open Playwright Inspector

# Headed mode (see browser)
npm run test:headed

# Debug mode
npm run test:debug
```

### 4. View Results
```bash
npm run report        # Open HTML test report
```

## ⚙️ Configuration

### .env.test Variables
```env
# Application
APP_URL=https://autoprosguests-qa.lovable.app

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Test User Credentials (create these in your Supabase auth)
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=password123
TEST_MANAGER_EMAIL=manager@example.com
TEST_MANAGER_PASSWORD=password123
TEST_DRIVER_EMAIL=driver@example.com
TEST_DRIVER_PASSWORD=password123
TEST_DRIVER_PHONE=555-0100
TEST_DISPATCHER_EMAIL=dispatcher@example.com
TEST_DISPATCHER_PASSWORD=password123
TEST_PM_EMAIL=pm@example.com
TEST_PM_PASSWORD=password123

# Webhook / legacy integration
# Zapier dual-write is no longer used by the app.
# TEST_WEBHOOK_URL=https://webhook.site/your-unique-id

# Test Data
TEST_PROPERTY_ID=your-property-id
```

## 📊 Test Coverage

### 1a. Authentication & RBAC (40+ tests)
- ✅ No Authorization header → 401
- ✅ Expired/invalid JWT → 401
- ✅ Role-based access control (Admin, Manager, Driver, Dispatcher, PM)
- ✅ Forbidden page access
- ✅ Sidebar navigation per role
- ✅ Financial data visibility restrictions (PM hidden)

### 1b. Input Validation (15+ tests)
- ✅ Invalid action names
- ✅ Plate format validation (SQL injection, length, state codes)
- ✅ Phone number sanitization
- ✅ Unit/vehicle field normalization
- ✅ Oversized JSON body handling
- ✅ Malformed JSON error handling

### 1c. State Transitions (25+ tests)
- ✅ Revoke: active → expired
- ✅ Reactivate: expired → active (with towed_at clear check)
- ✅ Accept: denied → active + approved decision
- ✅ Towed: active → towed with timestamp
- ✅ Manual-Tow: insert new row with synthetic token
- ✅ Edit: returns 400 "not yet implemented"

### 1d. Audit Trail (10+ tests)
- ✅ performed_by_id/name/role match caller
- ✅ Unknown profile handling
- ✅ updated_at increments on action
- ✅ Audit fields survive subsequent actions

### 1e. Legacy webhook integration
- ⚠️ Zapier dual-write is no longer used by the app.
- Legacy webhook tests are deprecated and may be removed.

### 1f. RLS / Direct DB Access (5+ tests)
- ✅ RLS blocks unauthorized access
- ✅ PM sees only assigned properties
- ✅ Anonymous blocked from permits table

### 2a. Authentication Flow (8 tests)
- ✅ Sign-in/out
- ✅ Session persistence
- ✅ Redirect to /auth when logged out
- ✅ No public signup path

### 2c. Permit Intake (15+ tests)
- ✅ GHL webhook handling
- ✅ Photo requirement enforcement
- ✅ Cooldown rule validation
- ✅ Monthly/active cap enforcement
- ✅ Duplicate deduplication
- ✅ Email queue validation

### 2e. Permits Page (15 tests)
- ✅ Filter by property, plate, date
- ✅ Sort columns
- ✅ Pagination (>1000 rows)
- ✅ Real-time updates (two-tab test)

### 2g. PM Portal (12+ tests)
- ✅ PM sees only assigned properties
- ✅ Cannot access unassigned via URL
- ✅ Cannot reach /admin, /users, /performance
- ✅ Register resident feature
- ✅ Issue manual guest pass
- ✅ Financial data NOT visible

### 2h. Public Routes (15+ tests)
- ✅ /feedback accepts unauthenticated POST
- ✅ /status lookup with plate + phone
- ✅ 15s auto-refresh on /status
- ✅ Rate limiting enforcement
- ✅ CORS headers correct

### 2i. Email System (20+ tests)
- ✅ permit-approved template
- ✅ permit-denied template with reason
- ✅ permit-expiring-soon (1-hour mark)
- ✅ towed-confirmation email
- ✅ Unsubscribe suppression
- ✅ PGMQ retries on failure
- ✅ Idempotency key prevents duplicates

### 2d. Expiry Sweeper (5 tests)
- ✅ Permits past expires_at flip to expired
- ✅ Expiring-soon email at 1-hour mark
- ✅ Idempotent re-runs

### Smoke Test (10 tests)
- ✅ Full end-to-end flow (admin → PM → driver → revoke)
- ✅ All audit trails captured
- ✅ Session persistence
- ✅ Error handling
- ✅ Performance baseline

## 🐛 Known Issues / Gaps (Regression Tests)

These tests document current behavior and should fail if the issues are fixed:

1. **reactivate does NOT clear towed_at** (Bug #1)
   - Test: `permit-actions.api.spec.js: RA2`
   - Towed permit reactivated still shows tow timestamp

2. **revoke on non-existent token returns 200** (Bug #2)
   - Test: `permit-actions.api.spec.js: R4`
   - Should return 404, not silent success

3. **accept has no legacy webhook notification** (Bug #3)
   - Test: `permit-actions.api.spec.js: DW6`
   - Denied→active transitions no longer send legacy webhook payloads

4. **edit action unimplemented** (Bug #4)
   - Test: `permit-actions.api.spec.js: E1`
   - Whitelisted but returns 400

5. **manual-tow token collision risk** (Bug #5)
   - Test: `permit-actions.api.spec.js: MT2`
   - Two manual tows in same millisecond may collide

6. **dualWriteZapier is awaited** (Bug #6)
   - Test: `permit-actions.api.spec.js: DW8`
   - Slow Zapier slows client response (should be async)

7. **No 404 on zero-row updates** (Bug #7)
   - Tests: `permit-actions.api.spec.js: R4, RA2, AC2`
   - Should return 404 when update affects 0 rows

## 🔧 Fixture & Utility API

### fixtures/auth.js
```javascript
await login(page, email, password)              // Returns JWT token
await logout(page)                              // Clear session
await isAuthenticated(page)                     // Check JWT exists
const user = await getCurrentUser(page)         // Get email, role
const headers = await getAuthHeaders(page)      // Get Authorization header
```

### fixtures/db.js
```javascript
const permit = await createTestPermit(data)     // Seed permit
const permit = await getPermit(permitId)        // Get permit
await updatePermit(permitId, updates)           // Update permit
const logs = await getNotificationLogs(filters) // Get email logs
await cleanupTestData({permits, properties})    // Cleanup after test
```

### fixtures/api.js
```javascript
const response = await callPermitAction(page, permitId, action, payload)
const response = await submitPermit(page, payload)
const response = await callGHLWebhook(page, payload)
const response = await makeUnauthenticatedRequest(page, method, path, options)
```

### fixtures/webhook.js
```javascript
// Removed: legacy webhook capture helpers are no longer used.
```

### utils/test-data.js
```javascript
buildPermit(overrides)                          // Create permit object
buildProperty(overrides)                        // Create property object
buildUserProfile(overrides)                     // Create user object
buildPermitActionPayload(action, overrides)     // Create action payload
buildGHLWebhookPayload(overrides)               // Create webhook payload
buildEmailPayload(eventType, overrides)         // Create email object
```

### utils/assertions.js
```javascript
await assertPermitStatus(permitId, 'active')
await assertPermitRevoked(permitId)
await assertPermitAudit(permitId, {performed_by_role: 'admin'})
assertApiSuccess(response, 200)
assertApiError(response, 400, 'Invalid action')
assertNotificationLogEntry(logs, 'permit-approved')
await assertElementVisible(page, selector)
```

## 📈 CI/CD Integration

### GitHub Actions Example
```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:tier1
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Environment Variables in CI
```bash
# Set in GitHub Secrets
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TEST_ADMIN_EMAIL
TEST_ADMIN_PASSWORD
TEST_DRIVER_EMAIL
TEST_DRIVER_PASSWORD
# ... etc
```

## 📝 Test Execution Strategy

### Local Development
1. Start with Tier 1: `npm run test:tier1`
2. Fix any failing tests (likely due to missing credentials)
3. Run full suite: `npm test`
4. Use `--headed` to debug failures

### PR / Pre-commit
- Run Tier 1 only (fastest feedback)
- Check for console errors and network leaks

### Main Branch / Nightly
- Run full suite (all tiers)
- Generate coverage report
- Monitor performance metrics

### Flaky Test Handling
- Tests marked with `[FLAKY]` in describe block
- Re-run 3 times in CI
- Real-time tests (two-tab) may require retry:
  ```javascript
  test.retries(2);
  ```

## 🔍 Debugging Tips

### View test in browser
```bash
npm run test:headed -- --grep "test name"
```

### Step through test
```bash
npm run test:debug
```

### View network traffic
```javascript
// In any test
page.on('response', response => {
  console.log(`${response.status()} ${response.url()}`);
});
```

### Generate HTML report
```bash
npm run report
```

### Check specific test logs
```bash
npm test -- --grep "A1: No Authorization" --verbose
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Supabase JS SDK](https://supabase.com/docs/reference/javascript)
- [Test Plan](./TEST_PLAN.md) - Detailed requirements mapping
- [Architecture Docs](./ARCHITECTURE.md) - System design reference

## ⚡ Performance Benchmarks

Target latencies (p95):
- Login: < 5 seconds
- Permit action: < 2 seconds
- Page load: < 3 seconds
- API call: < 1 second

## 🎯 Next Steps

1. **Populate .env.test** with real Supabase credentials
2. **Create test users** (admin, manager, driver, dispatcher, PM)
3. **Seed a test property** in Supabase
4. **Run Tier 1 tests**: `npm run test:tier1`
5. **Fix any failures** (likely auth/config issues)
6. **Run full suite**: `npm test`
7. **Review HTML report**: `npm run report`

---

**Last Updated**: May 2026  
**Test Count**: 150+  
**Coverage**: Authentication, RBAC, API, UI, Email, Security, Performance  
**Status**: Ready for integration
