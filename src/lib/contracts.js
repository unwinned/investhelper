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

// ─── Base Mainnet (chainId 8453 / 0x2105) ─────────────────────────────────────

export const BASE = {
  // AAVE v3
  AAVE_POOL:              '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
  AAVE_REFERRAL:          0,

  // Aerodrome (Velodrome fork — dominant Base DEX)
  AERODROME_ROUTER:       '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
  AERODROME_FACTORY:      '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',

  // Uniswap v3
  UNI_SWAP_ROUTER:        '0x2626664c2603336E57B271c5C0b26F421741e481',
  UNI_POSITION_MGR:       '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',

  // Infrastructure
  MULTICALL3:             '0xcA11bde05977b3631167028862bE2a173976CA11',
  MAX_UINT256:            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',

  // ERC-20 tokens
  WETH:                   '0x4200000000000000000000000000000000000006',
  USDC:                   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDBC:                  '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // bridged USDC
  CBETH:                  '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  CBBTC:                  '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  AERO:                   '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  DAI:                    '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',

  // AAVE v3 aTokens on Base
  A_USDC:                 '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
  A_USDBC:                '0x0a1d576f3eFeF75b330424287a95A366e8281D54',
  A_WETH:                 '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7',
  A_CBETH:                '0xcf3D55c10DB69a28fD32Ec923d31deafad413DD2',
}

// ─── BNB Smart Chain (chainId 56 / 0x38) ─────────────────────────────────────

export const BNB = {
  // AAVE v3
  AAVE_POOL:              '0x6807dc923806fE8Fd134338EABCA509979a7e0cB',
  AAVE_REFERRAL:          0,

  // PancakeSwap v2 (dominant DEX on BNB)
  PANCAKE_ROUTER_V2:      '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  PANCAKE_FACTORY_V2:     '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',

  // PancakeSwap v3
  PANCAKE_ROUTER_V3:      '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

  // Infrastructure
  MULTICALL3:             '0xcA11bde05977b3631167028862bE2a173976CA11',
  MAX_UINT256:            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',

  // ERC-20 tokens
  WBNB:                   '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDC:                   '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  USDT:                   '0x55d398326f99059fF775485246999027B3197955',
  BTCB:                   '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  ETH:                    '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  CAKE:                   '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  DAI:                    '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',

  // AAVE v3 aTokens on BNB
  A_USDC:                 '0x00901a076785e0906d1028c7d6372d247bec7d61',
  A_USDT:                 '0xa9251ca9DE909CB71783723Aa629949d77Bff3e0',
  A_ETH:                  '0x9B00a09492a626678e2E96bE2b2F7557aE48f33F',
  A_WBNB:                 '0x9B00a09492a626678e2E96bE2b2F7557aE48f33F',
  A_BTCB:                 '0x4197ba364AE6698015AE5c1468f54087602715b2',
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
