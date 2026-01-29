/**
 * Chain and Asset Configuration
 *
 * Defines supported chains and their valid assets for x402 config validation.
 */

// Supported chains with metadata
const CHAINS = {
  'base': {
    type: 'evm',
    name: 'Base',
    chainId: 8453
  },
  'base-sepolia': {
    type: 'evm',
    name: 'Base Sepolia',
    chainId: 84532
  },
  'solana': {
    type: 'solana',
    name: 'Solana',
    cluster: 'mainnet-beta'
  },
  'solana-devnet': {
    type: 'solana',
    name: 'Solana Devnet',
    cluster: 'devnet'
  }
};

// Valid assets per chain type
const ASSETS = {
  evm: ['USDC', 'ETH', 'USDT'],
  solana: ['USDC', 'SOL']
};

/**
 * Check if a chain identifier is known/supported
 * @param {string} chain - Chain identifier (e.g., 'base', 'solana')
 * @returns {boolean}
 */
function isKnownChain(chain) {
  return chain in CHAINS;
}

/**
 * Check if a chain is an EVM chain
 * @param {string} chain - Chain identifier
 * @returns {boolean}
 */
function isEVMChain(chain) {
  return isKnownChain(chain) && CHAINS[chain].type === 'evm';
}

/**
 * Check if a chain is a Solana chain
 * @param {string} chain - Chain identifier
 * @returns {boolean}
 */
function isSolanaChain(chain) {
  return isKnownChain(chain) && CHAINS[chain].type === 'solana';
}

/**
 * Get the chain type ('evm' or 'solana')
 * @param {string} chain - Chain identifier
 * @returns {string|null} - 'evm', 'solana', or null if unknown
 */
function getChainType(chain) {
  if (!isKnownChain(chain)) {
    return null;
  }
  return CHAINS[chain].type;
}

/**
 * Check if an asset is valid for a given chain
 * @param {string} chain - Chain identifier
 * @param {string} asset - Asset symbol (e.g., 'USDC', 'ETH', 'SOL')
 * @returns {boolean}
 */
function isValidAssetForChain(chain, asset) {
  const chainType = getChainType(chain);
  if (!chainType) {
    return false;
  }

  const validAssets = ASSETS[chainType];
  return validAssets.includes(asset);
}
