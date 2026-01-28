/**
 * x402 Input Handler
 *
 * Provides smart input detection (URL vs JSON), URL fetching via CORS proxy,
 * and x402 config extraction from PAYMENT-REQUIRED header or response body.
 */

// CORS Proxy deployed in Plan 02-01
const PROXY_URL = 'https://x402-proxy.mail-753.workers.dev';

// Timeout for URL fetches
const FETCH_TIMEOUT_MS = 5000;

/**
 * Detect input type based on content
 * @param {string} input - Raw user input
 * @returns {'url' | 'json'} - Detected input type
 */
function detectInputType(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }
  return 'json';
}

/**
 * Fetch x402 config from a URL via CORS proxy
 * @param {string} url - Target URL to fetch
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} proxyBaseUrl - Proxy base URL (defaults to PROXY_URL)
 * @returns {Promise<Object>} - { config: string, source: string, status: number, method: string, warning?: string }
 */
async function fetchConfigFromUrl(url, method = 'GET', proxyBaseUrl = PROXY_URL) {
  // Step 1: Validate URL format
  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // Step 2: Build proxy URL with method
  const proxyUrl = `${proxyBaseUrl}?url=${encodeURIComponent(url)}&method=${encodeURIComponent(method)}`;

  // Step 3: Fetch with timeout
  let response;
  try {
    response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Request timeout after 5 seconds - Check URL is reachable');
    }
    if (error.name === 'AbortError') {
      throw new Error('Request was cancelled');
    }
    throw new Error(`Network error: ${error.message}`);
  }

  // Step 4: Check response status (402 is expected for x402 endpoints)
  if (!response.ok && response.status !== 402) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Step 5: Extract config
  const result = await extractX402Config(response);
  result.method = method;
  result.url = url;
  return result;
}

/**
 * Extract x402 config from response (header-first, body fallback)
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} - { config: string, source: string, status: number, warning?: string }
 */
async function extractX402Config(response) {
  const status = response.status;

  // Priority 1: Check PAYMENT-REQUIRED header (x402 v2 standard)
  const paymentHeader = response.headers.get('PAYMENT-REQUIRED');
  if (paymentHeader) {
    // Try base64 decode first
    try {
      const decoded = atob(paymentHeader);
      const parsed = JSON.parse(decoded);
      return {
        config: JSON.stringify(parsed, null, 2),
        source: 'PAYMENT-REQUIRED header',
        status
      };
    } catch (base64Error) {
      // Try direct JSON parse (fallback for non-base64)
      try {
        const parsed = JSON.parse(paymentHeader);
        return {
          config: JSON.stringify(parsed, null, 2),
          source: 'PAYMENT-REQUIRED header',
          status
        };
      } catch (jsonError) {
        // Header exists but not valid - continue to body fallback
      }
    }
  }

  // Priority 2: Check response body (v1 compatibility)
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const bodyText = await response.text();

    // Validate JSON
    try {
      JSON.parse(bodyText);
    } catch (e) {
      throw new Error('No x402 Config Found - Response body is not valid JSON');
    }

    const result = {
      config: bodyText,
      source: 'response body',
      status
    };

    // Add warning for non-402 responses
    if (status !== 402) {
      result.warning = `Response status: ${status} - x402 endpoints should return 402 Payment Required`;
    }

    return result;
  }

  // Neither header nor body has config
  throw new Error('No x402 Config Found - Response had no PAYMENT-REQUIRED header or valid JSON body');
}

/**
 * Format JSON string for display (pretty print)
 * @param {string} jsonString - JSON string to format
 * @returns {string} - Formatted JSON or original if invalid
 */
function formatJsonForDisplay(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return jsonString;
  }
}

/**
 * Main entry point for validation - called by index.html
 * @param {string} inputValue - User input (URL or JSON)
 * @param {string} method - HTTP method for URL fetches
 * @param {Function} displayResultsFn - Function to display results
 * @param {Function} displayErrorFn - Function to display errors
 */
async function handleValidation(inputValue, method, displayResultsFn, displayErrorFn) {
  const inputType = detectInputType(inputValue);

  try {
    if (inputType === 'url') {
      // Fetch config from URL
      const result = await fetchConfigFromUrl(inputValue, method);

      // Validate fetched config
      const validationResult = validateX402Config(result.config);

      // Combine results with source info
      displayResultsFn({
        ...validationResult,
        source: result.source,
        method: result.method,
        url: result.url,
        fetchedConfig: result.config,
        warning: result.warning
      });
    } else {
      // Validate JSON directly
      const validationResult = validateX402Config(inputValue);

      displayResultsFn({
        ...validationResult,
        source: 'direct input'
      });
    }
  } catch (error) {
    displayErrorFn(error.message);
  }
}
