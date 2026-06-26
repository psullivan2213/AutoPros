/**
 * Test Data Utilities
 * Factories and builders for creating test data objects
 */

/**
 * Create a test permit object
 * @param {Object} overrides - Partial permit data to override defaults
 * @returns {Object} - Complete permit object
 */
export function buildPermit(overrides = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  return {
    id: overrides.id || `permit-${Date.now()}`,
    plate: overrides.plate || 'TEST123',
    property_id: overrides.property_id || process.env.TEST_PROPERTY_ID || 'prop-test',
    status: overrides.status || 'active',
    decision: overrides.decision || null,
    decision_reason: overrides.decision_reason || null,
    approval_token: overrides.approval_token || `token-${Date.now()}`,
    created_at: overrides.created_at || now.toISOString(),
    expires_at: overrides.expires_at || expiresAt.toISOString(),
    expired_at: overrides.expired_at || null,
    towed_at: overrides.towed_at || null,
    guest_email: overrides.guest_email || null,
    guest_name: overrides.guest_name || null,
    guest_phone: overrides.guest_phone || null,
    plate_state: overrides.plate_state || 'TX',
    vehicle_make: overrides.vehicle_make || 'Tesla',
    vehicle_model: overrides.vehicle_model || 'Model 3',
    vehicle_color: overrides.vehicle_color || 'White',
    photo_url: overrides.photo_url || null,
    performed_by_id: overrides.performed_by_id || null,
    performed_by_name: overrides.performed_by_name || 'Test User',
    performed_by_role: overrides.performed_by_role || 'admin',
    updated_at: overrides.updated_at || now.toISOString(),
    ...overrides
  };
}

/**
 * Create a test property object
 * @param {Object} overrides - Partial property data
 * @returns {Object} - Complete property object
 */
export function buildProperty(overrides = {}) {
  return {
    id: overrides.id || `prop-${Date.now()}`,
    name: overrides.name || 'Test Property',
    address: overrides.address || '123 Test Street, Austin, TX 78701',
    manager_id: overrides.manager_id || null,
    require_photo: overrides.require_photo ?? false,
    permit_duration_days: overrides.permit_duration_days ?? 30,
    cooldown_days: overrides.cooldown_days ?? 0,
    monthly_cap: overrides.monthly_cap ?? null,
    active_cap: overrides.active_cap ?? null,
    do_not_tow: overrides.do_not_tow ?? false,
    last_visited_at: overrides.last_visited_at || null,
    created_at: overrides.created_at || new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a test user profile object
 * @param {Object} overrides - Partial user data
 * @returns {Object} - Complete user object
 */
export function buildUserProfile(overrides = {}) {
  return {
    id: overrides.id || `user-${Date.now()}`,
    email: overrides.email || `test${Date.now()}@example.com`,
    name: overrides.name || 'Test User',
    role: overrides.role || 'driver',
    phone: overrides.phone || '555-0100',
    assigned_properties: overrides.assigned_properties || [],
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a permit action payload (for API calls)
 * @param {string} action - Action name
 * @param {Object} overrides - Partial payload data
 * @returns {Object} - Complete action payload
 */
export function buildPermitActionPayload(action, overrides = {}) {
  const now = new Date();
  
  const basePayload = {
    action,
    permit_id: overrides.permit_id || `permit-${Date.now()}`,
    approval_token: overrides.approval_token || `token-${Date.now()}`,
    ...overrides
  };
  
  // Add action-specific fields
  switch (action) {
    case 'revoke':
      return {
        ...basePayload,
        reason: overrides.reason || 'Revoked by admin'
      };
    
    case 'reactivate':
      return {
        ...basePayload
      };
    
    case 'accept':
      return {
        ...basePayload
      };
    
    case 'towed':
      return {
        ...basePayload,
        tow_reason: overrides.tow_reason || 'Unauthorized parking',
        guest_email: overrides.guest_email || null
      };
    
    case 'manual-tow':
      return {
        permit_id: undefined, // manual-tow doesn't use permit_id
        action: 'manual-tow',
        plate: overrides.plate || 'TEST123',
        plate_state: overrides.plate_state || 'TX',
        vehicle_make: overrides.vehicle_make || 'Tesla',
        vehicle_model: overrides.vehicle_model || 'Model 3',
        vehicle_color: overrides.vehicle_color || 'White',
        property_id: overrides.property_id || process.env.TEST_PROPERTY_ID || 'prop-test',
        notes: overrides.notes || 'Manual tow entry',
        tow_timestamp: overrides.tow_timestamp || now.toISOString(),
        ...overrides
      };
    
    case 'edit':
      return {
        ...basePayload,
        updates: overrides.updates || {}
      };
    
    default:
      return basePayload;
  }
}

/**
 * Create a permit submission payload (for intake)
 * @param {Object} overrides - Partial submission data
 * @returns {Object} - Complete submission payload
 */
export function buildPermitSubmission(overrides = {}) {
  return {
    phone: overrides.phone || '555-0100',
    plate: overrides.plate || 'TEST123',
    plate_state: overrides.plate_state || 'TX',
    vehicle_make: overrides.vehicle_make || 'Tesla',
    vehicle_model: overrides.vehicle_model || 'Model 3',
    vehicle_color: overrides.vehicle_color || 'White',
    property_id: overrides.property_id || process.env.TEST_PROPERTY_ID || 'prop-test',
    guest_name: overrides.guest_name || null,
    guest_email: overrides.guest_email || null,
    photo_url: overrides.photo_url || null,
    approval_token: overrides.approval_token || `token-${Date.now()}`,
    ...overrides
  };
}

/**
 * Create a resident registration payload (PM portal)
 * @param {Object} overrides - Partial resident data
 * @returns {Object} - Complete resident payload
 */
export function buildResidentRegistration(overrides = {}) {
  return {
    property_id: overrides.property_id || process.env.TEST_PROPERTY_ID || 'prop-test',
    name: overrides.name || 'Resident Name',
    email: overrides.email || `resident${Date.now()}@example.com`,
    phone: overrides.phone || '555-0200',
    unit: overrides.unit || '101',
    ...overrides
  };
}

/**
 * Create a guest pass payload (PM portal)
 * @param {Object} overrides - Partial guest data
 * @returns {Object} - Complete guest pass payload
 */
export function buildGuestPass(overrides = {}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (overrides.days || 1));
  
  return {
    property_id: overrides.property_id || process.env.TEST_PROPERTY_ID || 'prop-test',
    guest_name: overrides.guest_name || 'Guest Name',
    guest_email: overrides.guest_email || `guest${Date.now()}@example.com`,
    guest_phone: overrides.guest_phone || '555-0300',
    plate: overrides.plate || 'GUEST123',
    plate_state: overrides.plate_state || 'TX',
    vehicle_make: overrides.vehicle_make || 'Honda',
    vehicle_model: overrides.vehicle_model || 'Civic',
    vehicle_color: overrides.vehicle_color || 'Blue',
    expires_at: overrides.expires_at || expiresAt.toISOString(),
    ...overrides
  };
}

/**
 * Create a GHL webhook payload
 * @param {Object} overrides - Partial webhook data
 * @returns {Object} - Complete GHL webhook payload
 */
export function buildGHLWebhookPayload(overrides = {}) {
  return {
    type: 'permit_submission',
    contact_phone: overrides.contact_phone || '555-0100',
    contact_name: overrides.contact_name || 'Contact Name',
    contact_email: overrides.contact_email || `contact${Date.now()}@example.com`,
    vehicle_plate: overrides.vehicle_plate || 'TEST123',
    vehicle_state: overrides.vehicle_state || 'TX',
    vehicle_make: overrides.vehicle_make || 'Tesla',
    vehicle_model: overrides.vehicle_model || 'Model 3',
    vehicle_color: overrides.vehicle_color || 'White',
    property_id: overrides.property_id || process.env.TEST_PROPERTY_ID || 'prop-test',
    photo_url: overrides.photo_url || null,
    timestamp: overrides.timestamp || new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create an email/notification payload
 * @param {string} eventType - Event type (permit-approved, permit-denied, permit-expiring-soon, etc)
 * @param {Object} overrides - Partial email data
 * @returns {Object} - Complete email payload
 */
export function buildEmailPayload(eventType, overrides = {}) {
  const basePayload = {
    event_type: eventType,
    to_email: overrides.to_email || `test${Date.now()}@example.com`,
    subject: overrides.subject || `Test: ${eventType}`,
    timestamp: overrides.timestamp || new Date().toISOString(),
    ...overrides
  };
  
  switch (eventType) {
    case 'permit-approved':
      return {
        ...basePayload,
        permit_id: overrides.permit_id || `permit-${Date.now()}`,
        plate: overrides.plate || 'TEST123',
        property_name: overrides.property_name || 'Test Property'
      };
    
    case 'permit-denied':
      return {
        ...basePayload,
        permit_id: overrides.permit_id || `permit-${Date.now()}`,
        reason: overrides.reason || 'Exceeded monthly cap'
      };
    
    case 'permit-expiring-soon':
      return {
        ...basePayload,
        permit_id: overrides.permit_id || `permit-${Date.now()}`,
        plate: overrides.plate || 'TEST123',
        expires_at: overrides.expires_at || new Date().toISOString()
      };
    
    case 'towed-confirmation':
      return {
        ...basePayload,
        permit_id: overrides.permit_id || `permit-${Date.now()}`,
        plate: overrides.plate || 'TEST123',
        tow_reason: overrides.tow_reason || 'Unauthorized parking'
      };
    
    default:
      return basePayload;
  }
}

/**
 * Create a JWT-like token (for mocking auth)
 * @param {Object} claims - Token claims
 * @returns {string} - Encoded token (note: not cryptographically valid)
 */
export function buildMockJWT(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: claims.sub || 'user-123',
    email: claims.email || 'test@example.com',
    role: claims.role || 'driver',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims
  })).toString('base64');
  const signature = 'mock-signature';
  
  return `${header}.${payload}.${signature}`;
}

/**
 * Generate a unique plate for testing
 * @returns {string}
 */
export function generateUniquePlate() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let plate = '';
  for (let i = 0; i < 6; i++) {
    plate += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return plate;
}

/**
 * Generate a unique email for testing
 * @returns {string}
 */
export function generateUniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

/**
 * Generate a unique phone number for testing
 * @returns {string}
 */
export function generateUniquePhone() {
  const areaCode = Math.floor(Math.random() * 900) + 200;
  const exchange = Math.floor(Math.random() * 900) + 200;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `555-${String(areaCode).padStart(3, '0')}-${String(exchange).padStart(3, '0')}-${lineNumber}`;
}
