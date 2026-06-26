/**
 * Database Fixtures & Helpers
 * Provides direct Supabase access via service role for test data management
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.test') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

let supabaseClient = null;

/**
 * Initialize Supabase client with service role credentials
 * @returns {SupabaseClient}
 */
function initSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test');
  }
  
  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  return supabaseClient;
}

/**
 * Get Supabase client (lazy initialized)
 * @returns {SupabaseClient}
 */
export function getSupabase() {
  return initSupabase();
}

/**
 * Create a test permit
 * @param {Object} permitData - Permit data to create
 * @returns {Promise<Object>} - Created permit
 */
export async function createTestPermit(permitData) {
  const supabase = getSupabase();
  
  const permit = {
    plate: permitData.plate || 'TEST123',
    property_id: permitData.property_id || process.env.TEST_PROPERTY_ID,
    status: permitData.status || 'active',
    expires_at: permitData.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: permitData.created_at || new Date().toISOString(),
    ...permitData
  };
  
  const { data, error } = await supabase
    .from('permits')
    .insert([permit])
    .select('*');
  
  if (error) throw error;
  return data?.[0];
}

/**
 * Get a permit by ID
 * @param {string} permitId - Permit ID
 * @returns {Promise<Object>} - Permit data
 */
export async function getPermit(permitId) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('permits')
    .select('*')
    .eq('id', permitId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update a permit
 * @param {string} permitId - Permit ID
 * @param {Object} updates - Data to update
 * @returns {Promise<Object>} - Updated permit
 */
export async function updatePermit(permitId, updates) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('permits')
    .update(updates)
    .eq('id', permitId)
    .select('*');
  
  if (error) throw error;
  return data?.[0];
}

/**
 * Delete a permit
 * @param {string} permitId - Permit ID
 */
export async function deletePermit(permitId) {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('permits')
    .delete()
    .eq('id', permitId);
  
  if (error) throw error;
}

/**
 * Create a test property
 * @param {Object} propertyData - Property data
 * @returns {Promise<Object>} - Created property
 */
export async function createTestProperty(propertyData) {
  const supabase = getSupabase();
  
  const property = {
    name: propertyData.name || 'Test Property',
    address: propertyData.address || '123 Test St',
    ...propertyData
  };
  
  const { data, error } = await supabase
    .from('properties')
    .insert([property])
    .select('*');
  
  if (error) throw error;
  return data?.[0];
}

/**
 * Get a property by ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<Object>} - Property data
 */
export async function getProperty(propertyId) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create a test user profile
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - Created user
 */
export async function createTestUser(userData) {
  const supabase = getSupabase();
  
  const user = {
    email: userData.email,
    name: userData.name || userData.email.split('@')[0],
    role: userData.role || 'driver',
    ...userData
  };
  
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([user])
    .select('*');
  
  if (error) throw error;
  return data?.[0];
}

/**
 * Get notification log entries
 * @param {Object} filters - Filter criteria {table_name, record_id, event_type, etc}
 * @returns {Promise<Array>} - Notification log entries
 */
export async function getNotificationLogs(filters = {}) {
  const supabase = getSupabase();
  
  let query = supabase.from('notification_log').select('*');
  
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

/**
 * Clean up test data (delete created permits, properties, users)
 * @param {Object} cleanup - Objects to clean {permits: [ids], properties: [ids], users: [ids]}
 */
export async function cleanupTestData(cleanup = {}) {
  const supabase = getSupabase();
  
  if (cleanup.permits?.length) {
    const { error } = await supabase
      .from('permits')
      .delete()
      .in('id', cleanup.permits);
    if (error) console.error('Error cleaning up permits:', error);
  }
  
  if (cleanup.properties?.length) {
    const { error } = await supabase
      .from('properties')
      .delete()
      .in('id', cleanup.properties);
    if (error) console.error('Error cleaning up properties:', error);
  }
  
  if (cleanup.users?.length) {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .in('id', cleanup.users);
    if (error) console.error('Error cleaning up users:', error);
  }
}

/**
 * Seed test data (create multiple records)
 * @param {Object} seed - {permits: [], properties: [], users: []}
 * @returns {Promise<Object>} - Created IDs {permits: [], properties: [], users: []}
 */
export async function seedTestData(seed = {}) {
  const created = { permits: [], properties: [], users: [] };
  
  if (seed.properties?.length) {
    for (const prop of seed.properties) {
      const created_prop = await createTestProperty(prop);
      created.properties.push(created_prop.id);
    }
  }
  
  if (seed.permits?.length) {
    for (const permit of seed.permits) {
      const created_permit = await createTestPermit(permit);
      created.permits.push(created_permit.id);
    }
  }
  
  if (seed.users?.length) {
    for (const user of seed.users) {
      const created_user = await createTestUser(user);
      created.users.push(created_user.id);
    }
  }
  
  return created;
}

/**
 * Check if table exists and accessible
 * @param {string} tableName - Table name
 * @returns {Promise<boolean>}
 */
export async function canAccessTable(tableName) {
  const supabase = getSupabase();
  
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}
