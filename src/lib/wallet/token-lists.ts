export interface TrackedToken {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  geckoId: string;
}

export interface ChainTokenList {
  chainId: number;
  chainName: string;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
    geckoId: string;
  };
  tokens: TrackedToken[];
}

export const CHAIN_TOKEN_LISTS: ChainTokenList[] = [
  // ─── Ethereum Mainnet ───────────────────────────────────────────────
  {
    chainId: 1,
    chainName: "Ethereum",
    nativeToken: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      geckoId: "ethereum",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimals: 6,
        geckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
        geckoId: "tether",
      },
      {
        symbol: "DAI",
        name: "Dai Stablecoin",
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18,
        geckoId: "weth",
      },
      {
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        decimals: 8,
        geckoId: "wrapped-bitcoin",
      },
      {
        symbol: "AAVE",
        name: "Aave",
        address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
        decimals: 18,
        geckoId: "aave",
      },
      {
        symbol: "UNI",
        name: "Uniswap",
        address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        decimals: 18,
        geckoId: "uniswap",
      },
      {
        symbol: "LINK",
        name: "Chainlink",
        address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
        decimals: 18,
        geckoId: "chainlink",
      },
      {
        symbol: "stETH",
        name: "Lido Staked Ether",
        address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
        decimals: 18,
        geckoId: "staked-ether",
      },
      {
        symbol: "rETH",
        name: "Rocket Pool ETH",
        address: "0xae78736Cd615f374D3085123A210448E74Fc6393",
        decimals: 18,
        geckoId: "rocket-pool-eth",
      },
    ],
  },

  // ─── Arbitrum One ───────────────────────────────────────────────────
  {
    chainId: 42161,
    chainName: "Arbitrum",
    nativeToken: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      geckoId: "ethereum",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        decimals: 6,
        geckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        decimals: 6,
        geckoId: "tether",
      },
      {
        symbol: "DAI",
        name: "Dai Stablecoin",
        address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        decimals: 18,
        geckoId: "weth",
      },
      {
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        decimals: 8,
        geckoId: "wrapped-bitcoin",
      },
      {
        symbol: "ARB",
        name: "Arbitrum",
        address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        decimals: 18,
        geckoId: "arbitrum",
      },
      {
        symbol: "GMX",
        name: "GMX",
        address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
        decimals: 18,
        geckoId: "gmx",
      },
      {
        symbol: "LINK",
        name: "Chainlink",
        address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
        decimals: 18,
        geckoId: "chainlink",
      },
    ],
  },

  // ─── Optimism ───────────────────────────────────────────────────────
  {
    chainId: 10,
    chainName: "Optimism",
    nativeToken: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      geckoId: "ethereum",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        decimals: 6,
        geckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        decimals: 6,
        geckoId: "tether",
      },
      {
        symbol: "DAI",
        name: "Dai Stablecoin",
        address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        geckoId: "weth",
      },
      {
        symbol: "OP",
        name: "Optimism",
        address: "0x4200000000000000000000000000000000000042",
        decimals: 18,
        geckoId: "optimism",
      },
      {
        symbol: "LINK",
        name: "Chainlink",
        address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
        decimals: 18,
        geckoId: "chainlink",
      },
      {
        symbol: "wstETH",
        name: "Wrapped Staked Ether",
        address: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
        decimals: 18,
        geckoId: "wrapped-steth",
      },
    ],
  },

  // ─── Polygon ────────────────────────────────────────────────────────
  {
    chainId: 137,
    chainName: "Polygon",
    nativeToken: {
      symbol: "MATIC",
      name: "Polygon",
      decimals: 18,
      geckoId: "matic-network",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        decimals: 6,
        geckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        decimals: 6,
        geckoId: "tether",
      },
      {
        symbol: "DAI",
        name: "Dai Stablecoin",
        address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        decimals: 18,
        geckoId: "weth",
      },
      {
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
        decimals: 8,
        geckoId: "wrapped-bitcoin",
      },
      {
        symbol: "AAVE",
        name: "Aave",
        address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
        decimals: 18,
        geckoId: "aave",
      },
      {
        symbol: "LINK",
        name: "Chainlink",
        address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
        decimals: 18,
        geckoId: "chainlink",
      },
      {
        symbol: "WMATIC",
        name: "Wrapped Matic",
        address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        decimals: 18,
        geckoId: "wmatic",
      },
    ],
  },

  // ─── Base ───────────────────────────────────────────────────────────
  {
    chainId: 8453,
    chainName: "Base",
    nativeToken: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      geckoId: "ethereum",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        geckoId: "usd-coin",
      },
      {
        symbol: "DAI",
        name: "Dai Stablecoin",
        address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        geckoId: "weth",
      },
      {
        symbol: "cbETH",
        name: "Coinbase Wrapped Staked ETH",
        address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
        decimals: 18,
        geckoId: "coinbase-wrapped-staked-eth",
      },
      {
        symbol: "AERO",
        name: "Aerodrome Finance",
        address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
        decimals: 18,
        geckoId: "aerodrome-finance",
      },
    ],
  },

  // ─── BNB Smart Chain ────────────────────────────────────────────────
  {
    chainId: 56,
    chainName: "BSC",
    nativeToken: {
      symbol: "BNB",
      name: "BNB",
      decimals: 18,
      geckoId: "binancecoin",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        decimals: 18,
        geckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        geckoId: "tether",
      },
      {
        symbol: "DAI",
        name: "Dai Stablecoin",
        address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WBNB",
        name: "Wrapped BNB",
        address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        decimals: 18,
        geckoId: "binancecoin",
      },
      {
        symbol: "BTCB",
        name: "Bitcoin BEP2",
        address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
        decimals: 18,
        geckoId: "bitcoin-bep2",
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
        decimals: 18,
        geckoId: "ethereum",
      },
      {
        symbol: "CAKE",
        name: "PancakeSwap",
        address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
        decimals: 18,
        geckoId: "pancakeswap-token",
      },
    ],
  },

  // ─── Avalanche C-Chain ──────────────────────────────────────────────
  {
    chainId: 43114,
    chainName: "Avalanche",
    nativeToken: {
      symbol: "AVAX",
      name: "Avalanche",
      decimals: 18,
      geckoId: "avalanche-2",
    },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        decimals: 6,
        geckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
        decimals: 6,
        geckoId: "tether",
      },
      {
        symbol: "DAI.e",
        name: "Dai Stablecoin",
        address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
        decimals: 18,
        geckoId: "dai",
      },
      {
        symbol: "WAVAX",
        name: "Wrapped AVAX",
        address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        decimals: 18,
        geckoId: "avalanche-2",
      },
      {
        symbol: "WETH.e",
        name: "Wrapped Ether",
        address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
        decimals: 18,
        geckoId: "weth",
      },
      {
        symbol: "WBTC.e",
        name: "Wrapped Bitcoin",
        address: "0x50b7545627a5162F82A992c33b87aDc75187B218",
        decimals: 8,
        geckoId: "wrapped-bitcoin",
      },
      {
        symbol: "AAVE.e",
        name: "Aave",
        address: "0x63a72806098Bd3D9520cC43356dD78afe5D386D9",
        decimals: 18,
        geckoId: "aave",
      },
    ],
  },
];

export function getAllGeckoIds(): string[] {
  const ids = new Set<string>();
  for (const chain of CHAIN_TOKEN_LISTS) {
    ids.add(chain.nativeToken.geckoId);
    for (const token of chain.tokens) {
      ids.add(token.geckoId);
    }
  }
  return Array.from(ids);
}
