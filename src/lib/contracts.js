// ─── TON Mainnet ───────────────────────────────────────────────────────────────

export const TON = {
  // STON.fi DEX
  STONFI_ROUTER_V1:    'EQB3ncyBUTjZUA5EnFKR5_EnOMI9V1tTEAAPaiU71gc4TiUt',
  STONFI_ROUTER_V2_1:  'EQBCl1JANkTpMpJ9N3lZktPMpp2btRe2vVwHon0la8ibRied',
  STONFI_ROUTER_V2_2:  'EQCDT9dCT52pdfsLNW0e6qP5T3cgq7M4Ug72zkGYgP17tsWD',
  STONFI_PTON_V1:      'EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez',

  // DeDust DEX – Factory + native TON vault (deterministic from factory)
  DEDUST_FACTORY:      'EQBfBWT7X2BHg9tXAxzhz2aKiNTU1tpt5NsiK0uSDW_YAJ67',
  DEDUST_NATIVE_VAULT: 'EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_',

  // Liquid staking
  TONSTAKERS_POOL:     'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav', // tsTON master = pool
  BEMO_STAKING:        'EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k', // stTON minter
  HIPO_TREASURY:       'EQCLyZHP4Xe8fpchQz76O-_RmUhaVc_9BAoGyJrwJrcbz2eZ',

  // Evaa lending
  EVAA_MASTER:         'EQC52w4nWyJ0oKo5zDGY4rGaTkCTz_4WoFhp5UAYlbvG-LJl',

  // TON Jettons (mainnet masters)
  JUSDT:               'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  JUSDC:               'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
  WETH_TON:            'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmgikjxd6',
  WBTC_TON:            'EQDcBkGHmC4pTf34x3Gm05XvepO5w60DNxZ-XT4I6-UGG5L5',
  TSTON:               'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav',
  STTON:               'EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k',
  HTON:                'EQDPdq8xjAhytYqfGSX8KcFWIReCufsB9Wdg0pLlYSO_h76w',
}

// ─── Polygon Mainnet ───────────────────────────────────────────────────────────

export const POLYGON = {
  // AAVE v3
  AAVE_POOL:           '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  AAVE_REFERRAL:       0,

  // Uniswap v3
  UNI_SWAP_ROUTER:     '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02
  UNI_POSITION_MGR:    '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // NonfungiblePositionManager

  // QuickSwap v2
  QUICKSWAP_ROUTER:    '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',

  // Balancer v2
  BALANCER_VAULT:      '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  // Balancer WETH/WBTC/USDC pool ID (Polygon mainnet)
  BALANCER_WETH_WBTC_USDC_POOL_ID: '0x03cd191f589d12b0582a99808cf19851e468e6b500010000000000000000000a',
  // Balancer BAL/WETH pool ID
  BALANCER_BAL_WETH_POOL_ID: '0x3d468ab2329f296e1b9d8476bb54dd77d8c2320f000200000000000000000426',

  // Infrastructure
  MULTICALL3:          '0xcA11bde05977b3631167028862bE2a173976CA11',
  MAX_UINT256:         '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',

  // QuickSwap v2 Factory (for getPair)
  QUICKSWAP_FACTORY:   '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',

  // ERC-20 tokens
  USDC:                '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT:                '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  WETH:                '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  WBTC:                '0x1BFD67037B42Cf73acf2047067bd4F2C47D9BfD6',
  WMATIC:              '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  BAL:                 '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
  QUICK:               '0xB5C064F955D8e7F38fE0460C556a72987494eE17',

  // AAVE v3 aTokens (Polygon) — needed for balance checks and withdrawals
  A_USDC:              '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
  A_USDT:              '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
  A_WETH:              '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c5',
  A_WBTC:              '0x078f358208685046a11C85e8ad32895DED33A249',
}
