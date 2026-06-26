/**
 * API Fixtures & Helpers
 * Provides HTTP client for calling edge functions and API endpoints directly
 */

/**
 * Create an API client with headers and URL configuration
 * @param {Page} page - Playwright page object (for getting auth token)
 * @returns {Object} - API client with methods for common operations
 */
export function createApiClient(page) {
  const baseURL = process.env.APP_URL || 'https://real-connections-craft.lovable.app';
  
  return {
    baseURL,
    
    /**
     * Make a request with proper auth headers
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @param {Object} options - Request options {body, headers, etc}
     * @returns {Promise<Object>} - Response {status, data, headers}
     */
    async request(method, path, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      // Add auth header if page is provided and authenticated
      if (page) {
        const token = await getTokenFromPage(page);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      
      const response = await page.request[method.toLowerCase()](
        `${baseURL}${path}`,
        {
          ...options,
          headers
        }
      );
      
      let data = null;
      const contentType = response.headers()['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
      } else {
        data = await response.text();
      }
      
      return {
        status: response.status(),
        data,
        headers: response.headers()
      };
    },
    
    /**
     * POST request
     */
    async post(path, body, options = {}) {
      return this.request('POST', path, {
        ...options,
        data: body
      });
    },
    
    /**
     * GET request
     */
    async get(path, options = {}) {
      return this.request('GET', path, options);
    },
    
    /**
     * PUT request
     */
    async put(path, body, options = {}) {
      return this.request('PUT', path, {
        ...options,
        data: body
      });
    },
    
    /**
     * PATCH request
     */
    async patch(path, body, options = {}) {
      return this.request('PATCH', path, {
        ...options,
        data: body
      });
    },
    
    /**
     * DELETE request
     */
    async delete(path, options = {}) {
      return this.request('DELETE', path, options);
    }
  };
}

/**
 * Get token from page localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<string | null>}
 */
async function getTokenFromPage(page) {
  try {
    const auth = await page.evaluate(() => {
      const stored = localStorage.getItem('sb-auth');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });
    
    return auth?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Call a permit action endpoint directly
 * @param {Page} page - Playwright page object
 * @param {string} permitId - Permit ID
 * @param {string} action - Action name (revoke, reactivate, accept, towed, manual-tow, edit)
 * @param {Object} payload - Request payload
 * @returns {Promise<Object>} - Response {status, data}
 */
export async function callPermitAction(page, permitId, action, payload = {}) {
  const client = createApiClient(page);
  
  return client.post('/api/permit-action', {
    permit_id: permitId,
    action,
    ...payload
  });
}

/**
 * Call the submit-permit endpoint (for intake)
 * @param {Page} page - Playwright page object
 * @param {Object} payload - Permit submission payload
 * @returns {Promise<Object>} - Response {status, data}
 */
export async function submitPermit(page, payload) {
  const client = createApiClient(page);
  
  return client.post('/api/submit-permit', payload);
}

/**
 * Call the permit-expiry-sweeper endpoint
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} - Response {status, data}
 */
export async function runExpirySweeper(page) {
  const client = createApiClient(page);
  
  return client.post('/api/permit-expiry-sweeper', {});
}

/**
 * Call the GHL webhook (or simulate it)
 * @param {Page} page - Playwright page object
 * @param {Object} payload - GHL webhook payload
 * @returns {Promise<Object>} - Response {status, data}
 */
export async function callGHLWebhook(page, payload) {
  const client = createApiClient(page);
  
  return client.post('/api/webhooks/ghl-permit', payload);
}

/**
 * Make an unauthenticated request (for public endpoints)
 * @param {Page} page - Playwright page object
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response {status, data}
 */
export async function makeUnauthenticatedRequest(page, method, path, options = {}) {
  const baseURL = process.env.APP_URL || 'https://real-connections-craft.lovable.app';
  const url = `${baseURL}${path}`;
  
  const response = await page.request[method.toLowerCase()](url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  let data = null;
  const contentType = response.headers()['content-type'] || '';
  
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  } else {
    data = await response.text();
  }
  
  return {
    status: response.status(),
    data,
    headers: response.headers()
  };
}

/**
 * Make a request with a custom JWT token
 * @param {Page} page - Playwright page object
 * @param {string} token - JWT token to use
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response {status, data}
 */
export async function makeRequestWithToken(page, token, method, path, options = {}) {
  const baseURL = process.env.APP_URL || 'https://real-connections-craft.lovable.app';
  const url = `${baseURL}${path}`;
  
  const response = await page.request[method.toLowerCase()](url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    },
    ...options
  });
  
  let data = null;
  const contentType = response.headers()['content-type'] || '';
  
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  } else {
    data = await response.text();
  }
  
  return {
    status: response.status(),
    data,
    headers: response.headers()
  };
}
