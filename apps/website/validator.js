/**
 * x402 Config Validation Engine v2
 *
 * Supports all 3 real-world formats:
 * - Flat (Simple): {amount, currency, network, payTo}
 * - accepts (v1): {accepts: [{network, payTo, maxAmountRequired, asset}]}
 * - payments (v2): {x402Version, payments: [{chain, address, asset, minAmount}]}
 */

const SUPPORTED_CHAINS = ['solana', 'base', 'solana-devnet', 'base-sepolia'];

const CHAIN_ASSETS = {
  'solana': ['USDC', 'SOL'],
  'solana-devnet': ['USDC', 'SOL'],
  'base': ['USDC', 'ETH', 'USDT'],
  'base-sepolia': ['USDC', 'ETH', 'USDT']
};

// Field aliases - map non-canonical to canonical
const FIELD_ALIASES = {
  address: ['payTo', 'pay_to'],
  chain: ['network'],
  minAmount: ['amount', 'maxAmountRequired', 'max_amount_required'],
  asset: ['currency']
};

// Address validation patterns
const ADDRESS_PATTERNS = {
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  base: /^0x[a-fA-F0-9]{40}$/,
  'solana-devnet': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'base-sepolia': /^0x[a-fA-F0-9]{40}$/
};

/**
 * Detect which format the config is using
 */
function detectFormat(config) {
  if (config.x402Version && config.payments) {
    if (config.metadata || config.outputSchema || config.inputSchema) {
      return 'v2-marketplace';
    }
    return 'v2';
  }
  if (config.accepts) {
    return 'v1';
  }
  // Flat format - has payment fields at root level
  if (config.payTo || config.pay_to || config.address ||
      config.amount || config.minAmount || config.maxAmountRequired) {
    return 'flat';
  }
  return 'unknown';
}

/**
 * Get a field value checking aliases
 */
function getField(obj, canonicalName) {
  if (obj[canonicalName] !== undefined) {
    return { value: obj[canonicalName], usedAlias: null };
  }

  const aliases = FIELD_ALIASES[canonicalName] || [];
  for (const alias of aliases) {
    if (obj[alias] !== undefined) {
      return { value: obj[alias], usedAlias: alias };
    }
  }

  return { value: undefined, usedAlias: null };
}

/**
 * Normalize amount to human-readable format
 * Large numbers (>1000) are assumed to be micro-units
 */
function normalizeAmount(value) {
  if (value === undefined || value === null) {
    return { normalized: null, original: value, isMicroUnits: false };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { normalized: null, original: value, isMicroUnits: false, error: 'Invalid number' };
  }

  // Heuristic: if > 1000, assume micro-units (divide by 1,000,000)
  const isMicroUnits = num > 1000;
  const normalized = isMicroUnits ? num / 1_000_000 : num;

  return {
    normalized,
    original: value,
    isMicroUnits,
    microUnits: isMicroUnits ? num : Math.round(normalized * 1_000_000)
  };
}

/**
 * Normalize config to canonical v2 format
 */
function normalizeConfig(config) {
  const format = detectFormat(config);
  const usedAliases = [];
  let payments = [];

  if (format === 'flat') {
    // Convert flat to payments array
    const payment = {};

    const chain = getField(config, 'chain');
    if (chain.usedAlias) usedAliases.push(`${chain.usedAlias} → chain`);
    payment.chain = chain.value;

    const address = getField(config, 'address');
    if (address.usedAlias) usedAliases.push(`${address.usedAlias} → address`);
    payment.address = address.value;

    const asset = getField(config, 'asset');
    if (asset.usedAlias) usedAliases.push(`${asset.usedAlias} → asset`);
    payment.asset = asset.value;

    const amount = getField(config, 'minAmount');
    if (amount.usedAlias) usedAliases.push(`${amount.usedAlias} → minAmount`);
    payment.minAmount = amount.value;

    payments = [payment];
  } else if (format === 'v1') {
    // Convert accepts array to payments
    payments = (config.accepts || []).map(item => {
      const payment = {};

      const chain = getField(item, 'chain');
      if (chain.usedAlias) usedAliases.push(`${chain.usedAlias} → chain`);
      payment.chain = chain.value;

      const address = getField(item, 'address');
      if (address.usedAlias) usedAliases.push(`${address.usedAlias} → address`);
      payment.address = address.value;

      const asset = getField(item, 'asset');
      if (asset.usedAlias) usedAliases.push(`${asset.usedAlias} → asset`);
      payment.asset = asset.value;

      const amount = getField(item, 'minAmount');
      if (amount.usedAlias) usedAliases.push(`${amount.usedAlias} → minAmount`);
      payment.minAmount = amount.value;

      return payment;
    });
  } else if (format === 'v2' || format === 'v2-marketplace') {
    // Already in v2 format, but check for aliases within payments
    payments = (config.payments || []).map(item => {
      const payment = {};

      const chain = getField(item, 'chain');
      if (chain.usedAlias) usedAliases.push(`${chain.usedAlias} → chain`);
      payment.chain = chain.value;

      const address = getField(item, 'address');
      if (address.usedAlias) usedAliases.push(`${address.usedAlias} → address`);
      payment.address = address.value;

      const asset = getField(item, 'asset');
      if (asset.usedAlias) usedAliases.push(`${asset.usedAlias} → asset`);
      payment.asset = asset.value;

      const amount = getField(item, 'minAmount');
      if (amount.usedAlias) usedAliases.push(`${amount.usedAlias} → minAmount`);
      payment.minAmount = amount.value;

      return payment;
    });
  }

  return {
    x402Version: config.x402Version || 1,
    payments,
    outputSchema: config.outputSchema,
    inputSchema: config.inputSchema,
    metadata: config.metadata,
    _detectedFormat: format,
    _usedAliases: [...new Set(usedAliases)] // dedupe
  };
}

/**
 * Validate address format for chain
 */
function validateAddress(address, chain) {
  if (!address) return { valid: false, error: 'Missing address' };
  if (!chain) return { valid: false, error: 'Cannot validate without chain' };

  const pattern = ADDRESS_PATTERNS[chain];
  if (!pattern) return { valid: false, error: `Unknown chain: ${chain}` };

  // Check for wrong format
  const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  const isEVM = /^0x[a-fA-F0-9]{40}$/.test(address);

  if ((chain === 'solana' || chain === 'solana-devnet') && isEVM) {
    return { valid: false, error: 'EVM address format for Solana chain', detectedFormat: 'EVM' };
  }
  if ((chain === 'base' || chain === 'base-sepolia') && isBase58) {
    return { valid: false, error: 'Solana address format for Base chain', detectedFormat: 'Solana' };
  }

  if (!pattern.test(address)) {
    return { valid: false, error: 'Invalid address format' };
  }

  // For EVM, check checksum if mixed case
  if (isEVM && address !== address.toLowerCase() && address !== address.toUpperCase()) {
    try {
      const checksummed = ethers.utils.getAddress(address);
      if (address !== checksummed) {
        return { valid: false, error: 'Invalid checksum', suggestion: checksummed };
      }
    } catch (e) {
      return { valid: false, error: 'Invalid EVM address' };
    }
  }

  return { valid: true };
}

/**
 * Main validation function
 */
function validateX402Config(configText) {
  const errors = [];
  const warnings = [];

  // Parse JSON
  let config;
  try {
    config = typeof configText === 'string' ? JSON.parse(configText) : configText;
  } catch (e) {
    return {
      valid: false,
      errors: [{ field: 'root', message: 'Invalid JSON', fix: 'Check syntax' }],
      warnings: [],
      detectedFormat: 'unknown'
    };
  }

  // Detect and normalize
  const normalized = normalizeConfig(config);
  const format = normalized._detectedFormat;

  if (format === 'unknown') {
    errors.push({
      field: 'root',
      message: 'Unrecognized config format',
      fix: 'Use flat, accepts (v1), or payments (v2) format'
    });
    return { valid: false, errors, warnings, detectedFormat: format };
  }

  // Alias warnings
  if (normalized._usedAliases.length > 0) {
    normalized._usedAliases.forEach(alias => {
      warnings.push({
        field: 'alias',
        message: `Using "${alias.split(' → ')[0]}"`,
        fix: `Consider "${alias.split(' → ')[1]}" for v2 compliance`
      });
    });
  }

  // Format upgrade suggestion
  if (format === 'flat') {
    warnings.push({
      field: 'format',
      message: 'Using flat format',
      fix: 'Consider upgrading to v2 (payments array) for multi-chain support'
    });
  } else if (format === 'v1') {
    warnings.push({
      field: 'format',
      message: 'Using v1 (accepts) format',
      fix: 'Consider upgrading to v2 (payments array) for better compatibility'
    });
  }

  // Version field warning
  if (!config.x402Version) {
    warnings.push({
      field: 'x402Version',
      message: 'Missing x402Version field',
      fix: 'Add "x402Version": 1 for protocol compliance'
    });
  }

  // Validate payments
  if (!normalized.payments || normalized.payments.length === 0) {
    errors.push({
      field: 'payments',
      message: 'No payment options found',
      fix: 'Add at least one payment option'
    });
    return { valid: false, errors, warnings, detectedFormat: format, normalized };
  }

  // Validate each payment
  normalized.payments.forEach((payment, i) => {
    const prefix = normalized.payments.length > 1 ? `payments[${i}].` : '';

    // Chain
    if (!payment.chain) {
      errors.push({
        field: `${prefix}chain`,
        message: 'Missing chain/network',
        fix: `Add chain: one of ${SUPPORTED_CHAINS.join(', ')}`
      });
    } else if (!SUPPORTED_CHAINS.includes(payment.chain.toLowerCase())) {
      errors.push({
        field: `${prefix}chain`,
        message: `Unknown chain "${payment.chain}"`,
        fix: `Use one of: ${SUPPORTED_CHAINS.join(', ')}`
      });
    } else if (payment.chain !== payment.chain.toLowerCase()) {
      warnings.push({
        field: `${prefix}chain`,
        message: `Chain should be lowercase`,
        fix: `Use "${payment.chain.toLowerCase()}" instead of "${payment.chain}"`
      });
    }

    // Address
    if (!payment.address) {
      errors.push({
        field: `${prefix}address`,
        message: 'Missing payment address',
        fix: 'Add address (or payTo for flat format)'
      });
    } else if (payment.chain) {
      const addrValidation = validateAddress(payment.address, payment.chain.toLowerCase());
      if (!addrValidation.valid) {
        errors.push({
          field: `${prefix}address`,
          message: addrValidation.error,
          fix: addrValidation.suggestion ? `Use: ${addrValidation.suggestion}` : 'Check address format'
        });
      }
    }

    // Amount
    if (payment.minAmount === undefined && payment.minAmount === null) {
      errors.push({
        field: `${prefix}minAmount`,
        message: 'Missing amount',
        fix: 'Add minAmount (or amount for flat format)'
      });
    } else {
      const amountResult = normalizeAmount(payment.minAmount);
      if (amountResult.error) {
        errors.push({
          field: `${prefix}minAmount`,
          message: `Invalid amount: ${amountResult.error}`,
          fix: 'Use a valid number like "0.025" or 0.025'
        });
      } else if (amountResult.normalized <= 0) {
        errors.push({
          field: `${prefix}minAmount`,
          message: 'Amount must be greater than 0',
          fix: 'Use a positive amount'
        });
      } else if (amountResult.isMicroUnits) {
        warnings.push({
          field: `${prefix}minAmount`,
          message: `Detected micro-units (${amountResult.original})`,
          fix: `Human-readable: ${amountResult.normalized}`
        });
      }
      payment._normalizedAmount = amountResult;
    }

    // Asset
    if (!payment.asset) {
      errors.push({
        field: `${prefix}asset`,
        message: 'Missing asset/currency',
        fix: 'Add asset: USDC, ETH, SOL, etc.'
      });
    } else if (payment.chain) {
      const chainLower = payment.chain.toLowerCase();
      const validAssets = CHAIN_ASSETS[chainLower] || [];
      // Check if it's a known symbol or looks like a contract address
      const isContractAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payment.asset) ||
                                /^0x[a-fA-F0-9]{40}$/.test(payment.asset);
      if (!validAssets.includes(payment.asset.toUpperCase()) && !isContractAddress) {
        warnings.push({
          field: `${prefix}asset`,
          message: `Unknown asset "${payment.asset}" for ${chainLower}`,
          fix: `Common assets: ${validAssets.join(', ')}`
        });
      }
    }
  });

  // Marketplace readiness checks
  if (format === 'v2' || format === 'v2-marketplace') {
    if (!normalized.outputSchema) {
      warnings.push({
        field: 'outputSchema',
        message: 'No outputSchema provided',
        fix: 'Add outputSchema for agent compatibility'
      });
    }
    if (!normalized.metadata) {
      warnings.push({
        field: 'metadata',
        message: 'No marketplace metadata',
        fix: 'Add metadata (name, description) for marketplace listing'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedFormat: format,
    normalized,
    version: normalized.x402Version
  };
}

/**
 * Generate v2 equivalent of a config
 */
function generateV2Equivalent(config) {
  const normalized = normalizeConfig(config);

  const v2Config = {
    x402Version: 1,
    payments: normalized.payments.map(p => ({
      chain: (p.chain || '').toLowerCase(),
      address: p.address,
      asset: (p.asset || '').toUpperCase(),
      minAmount: p._normalizedAmount ? String(p._normalizedAmount.normalized) : p.minAmount
    }))
  };

  return JSON.stringify(v2Config, null, 2);
}
