/**
 * x402 Input Handler v4
 *
 * Uses the unified check() API from x402lint SDK.
 * No more adapter layer — check() returns display-ready data directly.
 */

const PROXY_URL = 'https://x402-proxy.mail-753.workers.dev';
const FETCH_TIMEOUT_MS = 10000;

// ── Input Detection ────────────────────────────────────────────────────────

/**
 * Detect input type based on content
 */
function detectInputType(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }
  return 'json';
}

// ── URL Testing ────────────────────────────────────────────────────────────

/**
 * Test a URL via proxy and run check() on the response.
 */
async function testX402Url(url, method = 'GET', body = null) {
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}&method=${encodeURIComponent(method)}`;

  let response;
  try {
    response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Request timeout - endpoint may be unreachable');
    }
    throw new Error(`Network error: ${error.message}`);
  }

  // Read response body
  let rawBody = null;
  try {
    rawBody = await response.text();
  } catch (e) {
    console.log('Failed to read body:', e.message);
  }

  // Parse body as JSON for check()
  let parsedBody = null;
  if (rawBody && rawBody.trim()) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (e) {
      // Not valid JSON — leave as null, check() will try headers
    }
  }

  // Build headers for check()
  const headers = {};
  const paymentHeader = response.headers.get('PAYMENT-REQUIRED');
  if (paymentHeader) {
    headers['PAYMENT-REQUIRED'] = paymentHeader;
  }

  // Unified check: extraction + validation + registry lookups
  const checkResult = window.x402Lint.check({ body: parsedBody, headers });

  // Build endpoint checklist from response + checkResult
  const checks = {
    returns402: {
      pass: response.status === 402,
      label: 'Returns 402',
      detail: response.status === 402 ? null : `Returned ${response.status}`
    },
    hasConfig: {
      pass: checkResult.extracted,
      label: 'Valid payment config',
      detail: checkResult.extracted
        ? `Found in ${checkResult.source === 'header' ? 'PAYMENT-REQUIRED header' : 'response body'}`
        : 'No valid config found'
    },
    hasHeader: {
      pass: !!paymentHeader,
      label: 'PAYMENT-REQUIRED header',
      detail: paymentHeader ? 'Present (base64)' : 'Not present (optional)'
    },
    hasCors: {
      pass: true,
      label: 'CORS accessible',
      detail: 'Via proxy'
    }
  };

  // Add format check when we have a config
  if (checkResult.extracted) {
    checks.formatCheck = {
      pass: checkResult.version === 'v2',
      label: 'Using v2 format',
      detail: checkResult.version === 'v2' ? 'Canonical format' : `Using ${checkResult.version} format`
    };
  }

  return {
    checks,
    validation: checkResult,
    rawBody,
    status: response.status,
    method,
    url
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────

/**
 * Main handler for validation
 */
async function handleValidation(inputValue, method, displayResultsFn, displayErrorFn) {
  const inputType = detectInputType(inputValue);

  try {
    if (inputType === 'url') {
      const result = await testX402Url(inputValue, method);
      displayResultsFn({
        type: 'url',
        ...result
      });
    } else {
      // JSON input — wrap in ResponseLike shape for check()
      let parsed;
      try {
        parsed = JSON.parse(inputValue);
      } catch (e) {
        displayErrorFn('Invalid JSON: ' + e.message);
        return;
      }
      const checkResult = window.x402Lint.check({ body: parsed });
      displayResultsFn({
        type: 'json',
        validation: checkResult,
        config: parsed
      });
    }
  } catch (error) {
    displayErrorFn(error.message);
  }
}

/**
 * Format JSON for display
 */
function formatJsonForDisplay(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return jsonString;
  }
}
