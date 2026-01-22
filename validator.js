/**
 * x402 Config Validation Engine
 *
 * Validates x402 payment configurations against v1 and v2 schemas.
 * Returns detailed errors and warnings with field paths and fix suggestions.
 */

/**
 * Main validation function
 * @param {string} configText - JSON string of x402 config
 * @returns {Object} { valid: boolean, version: number, errors: Array, warnings: Array }
 */
function validateX402Config(configText) {
  const errors = [];
  const warnings = [];

  // Layer 1: JSON Parse
  let config;
  try {
    config = JSON.parse(configText);
  } catch (e) {
    const location = getJsonErrorLocation(e);
    return {
      valid: false,
      version: null,
      errors: [{
        field: 'root',
        message: `Invalid JSON syntax: ${e.message}`,
        fix: location ? `Check syntax near ${location}` : 'Verify JSON is properly formatted'
      }],
      warnings: []
    };
  }

  // Layer 2: Version Check (VAL-01)
  if (!config.x402Version) {
    errors.push({
      field: 'x402Version',
      message: 'Missing required field',
      fix: 'Add "x402Version": 1 or "x402Version": 2 at top level'
    });
    return { valid: false, version: null, errors, warnings };
  }

  const version = config.x402Version;
  if (![1, 2].includes(version)) {
    errors.push({
      field: 'x402Version',
      message: `Invalid version: ${version}`,
      fix: 'Use version 1 or 2'
    });
    return { valid: false, version: null, errors, warnings };
  }

  // Layer 3: Payments Array (VAL-02)
  const paymentsField = version === 1 ? 'payments' : 'accepts';
  const addressField = version === 1 ? 'address' : 'payTo';
  const amountField = version === 1 ? 'minAmount' : 'price';

  if (!config[paymentsField]) {
    errors.push({
      field: paymentsField,
      message: 'Missing required field',
      fix: `Add "${paymentsField}": [...] with at least one payment option`
    });
    return { valid: false, version, errors, warnings };
  }

  if (!Array.isArray(config[paymentsField])) {
    errors.push({
      field: paymentsField,
      message: 'Must be an array',
      fix: `Change "${paymentsField}" to an array: [...] `
    });
    return { valid: false, version, errors, warnings };
  }

  if (config[paymentsField].length === 0) {
    errors.push({
      field: paymentsField,
      message: 'Array cannot be empty',
      fix: 'Add at least one payment option to the array'
    });
    return { valid: false, version, errors, warnings };
  }

  // Layer 4: Payment Entry Validation
  config[paymentsField].forEach((payment, i) => {
    const path = `${paymentsField}[${i}]`;

    // VAL-03: Required fields check
    const requiredFields = {
      'chain': 'Chain identifier (e.g., "base", "solana")',
      [addressField]: 'Payment recipient address',
      'asset': 'Asset symbol (e.g., "USDC", "ETH", "SOL")',
      [amountField]: 'Minimum payment amount'
    };

    Object.entries(requiredFields).forEach(([field, description]) => {
      if (!payment[field]) {
        errors.push({
          field: `${path}.${field}`,
          message: 'Missing required field',
          fix: `Add "${field}": "${description}"`
        });
      }
    });

    // Skip further validation if required fields missing
    if (!payment.chain || !payment[addressField] || !payment.asset || !payment[amountField]) {
      return;
    }

    // VAL-04: Chain validation
    if (!isKnownChain(payment.chain)) {
      errors.push({
        field: `${path}.chain`,
        message: `Unknown chain: "${payment.chain}"`,
        fix: 'Use one of: base, base-sepolia, solana, solana-devnet'
      });
      return; // Can't validate address without knowing chain type
    }

    // VAL-05, VAL-06: Address validation
    const address = payment[addressField];
    const addressValidation = validateAddress(address, payment.chain, `${path}.${addressField}`);
    errors.push(...addressValidation.errors);
    warnings.push(...addressValidation.warnings);

    // VAL-07: Asset validation
    if (!isValidAssetForChain(payment.chain, payment.asset)) {
      const chainType = getChainType(payment.chain);
      const validAssets = chainType === 'evm' ? 'USDC, ETH, USDT' : 'USDC, SOL';
      errors.push({
        field: `${path}.asset`,
        message: `"${payment.asset}" is not valid for ${payment.chain}`,
        fix: `Use one of: ${validAssets}`
      });
    }

    // VAL-08: Amount validation
    const amountValidation = validatePositiveDecimal(payment[amountField], `${path}.${amountField}`);
    errors.push(...amountValidation.errors);

    // VAL-09: Optional fields
    if (payment.facilitator) {
      const facilitatorValidation = validateFacilitator(payment.facilitator, `${path}.facilitator`);
      warnings.push(...facilitatorValidation.warnings);
    }

    if (payment.maxAmount) {
      const minAmount = parseFloat(payment[amountField]);
      const maxAmount = parseFloat(payment.maxAmount);

      if (!isNaN(minAmount) && !isNaN(maxAmount) && maxAmount < minAmount) {
        errors.push({
          field: `${path}.maxAmount`,
          message: `maxAmount (${maxAmount}) is less than ${amountField} (${minAmount})`,
          fix: `Set maxAmount >= ${minAmount} or remove maxAmount field`
        });
      }
    }
  });

  // VAL-10: Return with error/warning separation
  return {
    valid: errors.length === 0,
    version,
    errors,
    warnings
  };
}

/**
 * Validate address format and checksum
 * @param {string} address - Address to validate
 * @param {string} chain - Chain identifier
 * @param {string} fieldPath - Field path for error reporting
 * @returns {Object} { errors: Array, warnings: Array }
 */
function validateAddress(address, chain, fieldPath) {
  const errors = [];
  const warnings = [];

  if (isEVMChain(chain)) {
    const evmValidation = validateEvmAddress(address, fieldPath);
    errors.push(...evmValidation.errors);
    warnings.push(...evmValidation.warnings);
  } else if (isSolanaChain(chain)) {
    const solanaValidation = validateSolanaAddress(address, fieldPath);
    errors.push(...solanaValidation.errors);
    warnings.push(...solanaValidation.warnings);
  }

  return { errors, warnings };
}

/**
 * Validate EVM address with checksum (VAL-05)
 * @param {string} address - EVM address
 * @param {string} fieldPath - Field path for error reporting
 * @returns {Object} { errors: Array, warnings: Array }
 */
function validateEvmAddress(address, fieldPath) {
  const errors = [];
  const warnings = [];

  // Check basic format
  if (!address.startsWith('0x')) {
    errors.push({
      field: fieldPath,
      message: `"${address}" is not a valid EVM address`,
      fix: 'EVM addresses must start with "0x"'
    });
    return { errors, warnings };
  }

  if (address.length !== 42) {
    errors.push({
      field: fieldPath,
      message: `"${address}" is not a valid EVM address`,
      fix: 'EVM addresses are 42 characters (0x + 40 hex digits)'
    });
    return { errors, warnings };
  }

  // Validate with ethers.js (includes checksum validation)
  try {
    const checksummed = ethers.utils.getAddress(address);

    // Check if input had mixed case (implies checksum intent)
    const hasMixedCase = address !== address.toLowerCase() && address !== address.toUpperCase();

    if (hasMixedCase && address !== checksummed) {
      errors.push({
        field: fieldPath,
        message: 'Address has invalid checksum',
        fix: `Use checksummed address: ${checksummed}`
      });
    }

    // Warn if all lowercase (valid but lacks checksum protection)
    if (address === address.toLowerCase()) {
      warnings.push({
        field: fieldPath,
        message: 'Address is all lowercase (valid but no checksum protection)',
        fix: `Consider using checksummed format: ${checksummed}`
      });
    }
  } catch (e) {
    errors.push({
      field: fieldPath,
      message: `Invalid EVM address format: ${e.message}`,
      fix: 'EVM addresses must be 42 hex characters (0x + 40 hex digits)'
    });
  }

  return { errors, warnings };
}

/**
 * Validate Solana address (VAL-06)
 * @param {string} address - Solana address
 * @param {string} fieldPath - Field path for error reporting
 * @returns {Object} { errors: Array, warnings: Array }
 */
function validateSolanaAddress(address, fieldPath) {
  const errors = [];
  const warnings = [];

  // Check for EVM format (common mistake)
  if (address.startsWith('0x')) {
    errors.push({
      field: fieldPath,
      message: 'EVM address format detected for Solana chain',
      fix: 'Solana addresses use Base58 encoding (no 0x prefix)'
    });
    return { errors, warnings };
  }

  // Basic format check
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    errors.push({
      field: fieldPath,
      message: `"${address}" is not a valid Solana address`,
      fix: 'Solana addresses use Base58 encoding (32-44 characters, no 0/O/I/l)'
    });
    return { errors, warnings };
  }

  // Decode and verify length
  try {
    const decoded = bs58.decode(address);

    if (decoded.length !== 32) {
      errors.push({
        field: fieldPath,
        message: `Address decodes to ${decoded.length} bytes (expected 32)`,
        fix: 'Verify the address is complete and unmodified'
      });
    }
  } catch (e) {
    errors.push({
      field: fieldPath,
      message: 'Invalid Base58 encoding',
      fix: 'Check for invalid characters in address'
    });
  }

  return { errors, warnings };
}

/**
 * Validate positive decimal amount (VAL-08)
 * @param {string|number} value - Amount value
 * @param {string} fieldPath - Field path for error reporting
 * @returns {Object} { errors: Array }
 */
function validatePositiveDecimal(value, fieldPath) {
  const errors = [];

  // Check type
  if (typeof value !== 'string' && typeof value !== 'number') {
    errors.push({
      field: fieldPath,
      message: 'Must be a number or numeric string',
      fix: 'Use format like "1.00" or 1.00'
    });
    return { errors };
  }

  const str = String(value);

  // Reject scientific notation
  if (/[eE]/.test(str)) {
    errors.push({
      field: fieldPath,
      message: 'Scientific notation not allowed',
      fix: 'Use decimal format (e.g., "1.50" instead of "1.5e0")'
    });
    return { errors };
  }

  // Parse and validate
  const num = parseFloat(str);

  if (isNaN(num)) {
    errors.push({
      field: fieldPath,
      message: `"${value}" is not a valid number`,
      fix: 'Use a positive decimal number (e.g., "1.00")'
    });
    return { errors };
  }

  if (num <= 0) {
    errors.push({
      field: fieldPath,
      message: `Amount must be greater than zero (got ${value})`,
      fix: 'Use a positive amount (e.g., "1.00")'
    });
    return { errors };
  }

  // Validate decimal format
  if (!/^\d+(\.\d+)?$/.test(str)) {
    errors.push({
      field: fieldPath,
      message: `Invalid decimal format: "${value}"`,
      fix: 'Use positive decimal format (e.g., "1.50")'
    });
  }

  return { errors };
}

/**
 * Validate facilitator object (VAL-09)
 * @param {Object} facilitator - Facilitator configuration
 * @param {string} fieldPath - Field path for error reporting
 * @returns {Object} { warnings: Array }
 */
function validateFacilitator(facilitator, fieldPath) {
  const warnings = [];

  if (facilitator.url) {
    const url = facilitator.url;

    // Check if HTTP instead of HTTPS
    if (url.startsWith('http://')) {
      warnings.push({
        field: `${fieldPath}.url`,
        message: 'Facilitator URL uses HTTP instead of HTTPS',
        fix: 'Use HTTPS for secure communication'
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (e) {
      warnings.push({
        field: `${fieldPath}.url`,
        message: `Invalid URL format: ${url}`,
        fix: 'Use complete URL with protocol (e.g., "https://example.com")'
      });
    }
  }

  return { warnings };
}

/**
 * Extract line/column information from JSON parse error
 * @param {Error} error - JSON parse error
 * @returns {string|null} - Location description or null
 */
function getJsonErrorLocation(error) {
  const message = error.message;

  // Try to extract position from error message
  const positionMatch = message.match(/position (\d+)/);
  if (positionMatch) {
    return `position ${positionMatch[1]}`;
  }

  const lineMatch = message.match(/line (\d+)/);
  if (lineMatch) {
    return `line ${lineMatch[1]}`;
  }

  return null;
}
