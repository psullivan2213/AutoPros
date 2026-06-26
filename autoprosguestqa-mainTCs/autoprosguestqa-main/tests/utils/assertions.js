/**
 * Assertion Utilities
 * Common database and state assertions for testing
 */

import { expect } from '@playwright/test';
import { getPermit } from '../fixtures/db.js';

/**
 * Assert permit status
 * @param {string} permitId - Permit ID
 * @param {string} expectedStatus - Expected status (active, expired, towed, denied)
 */
export async function assertPermitStatus(permitId, expectedStatus) {
  const permit = await getPermit(permitId);
  expect(permit.status).toBe(expectedStatus);
}

/**
 * Assert permit has been revoked
 * @param {string} permitId - Permit ID
 */
export async function assertPermitRevoked(permitId) {
  const permit = await getPermit(permitId);
  expect(permit.status).toBe('expired');
  expect(permit.expired_at).not.toBeNull();
}

/**
 * Assert permit has been reactivated
 * @param {string} permitId - Permit ID
 */
export async function assertPermitReactivated(permitId) {
  const permit = await getPermit(permitId);
  expect(permit.status).toBe('active');
  expect(permit.expired_at).toBeNull();
}

/**
 * Assert permit has been accepted/approved
 * @param {string} permitId - Permit ID
 */
export async function assertPermitAccepted(permitId) {
  const permit = await getPermit(permitId);
  expect(permit.status).toBe('active');
  expect(permit.decision).toBe('approved');
}

/**
 * Assert permit has been marked as towed
 * @param {string} permitId - Permit ID
 */
export async function assertPermitTowed(permitId) {
  const permit = await getPermit(permitId);
  expect(permit.status).toBe('towed');
  expect(permit.towed_at).not.toBeNull();
}

/**
 * Assert permit audit trail (performed_by fields)
 * @param {string} permitId - Permit ID
 * @param {Object} expectedAudit - Expected {performed_by_id, performed_by_name, performed_by_role}
 */
export async function assertPermitAudit(permitId, expectedAudit) {
  const permit = await getPermit(permitId);
  
  if (expectedAudit.performed_by_id) {
    expect(permit.performed_by_id).toBe(expectedAudit.performed_by_id);
  }
  if (expectedAudit.performed_by_name) {
    expect(permit.performed_by_name).toBe(expectedAudit.performed_by_name);
  }
  if (expectedAudit.performed_by_role) {
    expect(permit.performed_by_role).toBe(expectedAudit.performed_by_role);
  }
}

/**
 * Assert permit updated_at changed
 * @param {string} permitId - Permit ID
 * @param {string} previousUpdatedAt - Previous updated_at timestamp
 */
export async function assertPermitUpdatedAtChanged(permitId, previousUpdatedAt) {
  const permit = await getPermit(permitId);
  expect(new Date(permit.updated_at)).toBeGreaterThan(new Date(previousUpdatedAt));
}

/**
 * Assert API response error
 * @param {Object} response - API response {status, data}
 * @param {number} expectedStatus - Expected HTTP status code
 * @param {string} expectedMessage - Expected error message (optional)
 */
export function assertApiError(response, expectedStatus, expectedMessage = null) {
  expect(response.status).toBe(expectedStatus);
  
  if (expectedMessage && response.data?.message) {
    expect(response.data.message).toContain(expectedMessage);
  }
}

/**
 * Assert API response success
 * @param {Object} response - API response {status, data}
 * @param {number} expectedStatus - Expected HTTP status code (default 200)
 */
export function assertApiSuccess(response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.data).toBeDefined();
}

/**
 * Assert permit field value
 * @param {string} permitId - Permit ID
 * @param {string} fieldName - Field name to check
 * @param {*} expectedValue - Expected value
 */
export async function assertPermitField(permitId, fieldName, expectedValue) {
  const permit = await getPermit(permitId);
  expect(permit[fieldName]).toBe(expectedValue);
}

/**
 * Assert permit fields match expected values
 * @param {string} permitId - Permit ID
 * @param {Object} expectedFields - Fields to check {field: value, ...}
 */
export async function assertPermitFields(permitId, expectedFields) {
  const permit = await getPermit(permitId);
  
  for (const [field, expectedValue] of Object.entries(expectedFields)) {
    expect(permit[field]).toBe(expectedValue);
  }
}

/**
 * Assert notification log entry exists
 * @param {Array} logs - Notification logs
 * @param {string} eventType - Event type to find
 * @param {string} permitId - Permit ID (optional)
 * @returns {Object} - Found log entry
 */
export function assertNotificationLogEntry(logs, eventType, permitId = null) {
  const entry = logs.find(log =>
    log.event_type === eventType &&
    (!permitId || log.record_id === permitId)
  );
  
  expect(entry).toBeDefined();
  return entry;
}

/**
 * Assert email was sent
 * @param {Array} logs - Notification logs
 * @param {string} toEmail - Expected recipient email
 * @param {string} eventType - Event type
 * @returns {Object} - Found log entry
 */
export function assertEmailSent(logs, toEmail, eventType) {
  const entry = logs.find(log =>
    log.event_type === eventType &&
    log.recipient_email === toEmail
  );
  
  expect(entry).toBeDefined();
  return entry;
}

/**
 * Assert no duplicate notifications
 * @param {Array} logs - Notification logs
 * @param {string} permitId - Permit ID
 * @param {string} eventType - Event type
 */
export function assertNoDuplicateNotifications(logs, permitId, eventType) {
  const matching = logs.filter(log =>
    log.record_id === permitId &&
    log.event_type === eventType
  );
  
  expect(matching.length).toBeLessThanOrEqual(1);
}

/**
 * Assert UI element text content
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {string} expectedText - Expected text
 */
export async function assertElementText(page, selector, expectedText) {
  const element = await page.locator(selector);
  await expect(element).toContainText(expectedText);
}

/**
 * Assert UI element is visible
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector
 */
export async function assertElementVisible(page, selector) {
  const element = await page.locator(selector);
  await expect(element).toBeVisible();
}

/**
 * Assert UI element is hidden
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector
 */
export async function assertElementHidden(page, selector) {
  const element = await page.locator(selector);
  await expect(element).toBeHidden();
}

/**
 * Assert form validation message
 * @param {Page} page - Playwright page object
 * @param {string} message - Expected validation message
 */
export async function assertValidationMessage(page, message) {
  await expect(page.locator('[role="alert"], [data-testid="error-message"], .error')).toContainText(message);
}

/**
 * Assert success toast message
 * @param {Page} page - Playwright page object
 * @param {string} message - Expected success message
 */
export async function assertSuccessMessage(page, message) {
  await expect(page.locator('[role="status"], [data-testid="success-message"], .success')).toContainText(message);
}

/**
 * Assert response payload structure
 * @param {Object} payload - Response payload
 * @param {Array<string>} requiredFields - Required field names
 */
export function assertPayloadStructure(payload, requiredFields = []) {
  for (const field of requiredFields) {
    expect(payload).toHaveProperty(field);
  }
}

/**
 * Assert permit state transition valid
 * Checks that a state transition is valid
 * @param {string} fromStatus - From status
 * @param {string} toStatus - To status
 * @param {string} action - Action performed
 */
export function assertValidStateTransition(fromStatus, toStatus, action) {
  const validTransitions = {
    revoke: { active: 'expired', expired: 'expired', towed: 'expired' },
    reactivate: { expired: 'active', towed: 'active', denied: 'active', active: 'active' },
    accept: { denied: 'active', active: 'active', expired: 'active', towed: 'active' },
    towed: { active: 'towed', towed: 'towed' }
  };
  
  const allowed = validTransitions[action];
  if (allowed) {
    const isValid = allowed[fromStatus] === toStatus;
    expect(isValid).toBe(true);
  }
}
