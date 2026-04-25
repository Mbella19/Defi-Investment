// Maps a protocol name to its official deposit/app entry point. Falls back to
// the DeFiLlama Yields page for the specific pool, which always resolves and
// links onward to the protocol's deposit screen.

const PROTOCOL_APP_URLS: Record<string, string> = {
  aave: "https://app.aave.com/",
  "aave-v2": "https://app.aave.com/",
  "aave-v3": "https://app.aave.com/",
  compound: "https://app.compound.finance/",
  "compound-v2": "https://app.compound.finance/",
  "compound-v3": "https://app.compound.finance/",
  morpho: "https://app.morpho.org/",
  "morpho-blue": "https://app.morpho.org/",
  "morpho-aave": "https://app.morpho.org/",
  fluid: "https://fluid.instadapp.io/",
  pendle: "https://app.pendle.finance/",
  curve: "https://curve.fi/",
  "curve-dex": "https://curve.fi/",
  convex: "https://www.convexfinance.com/",
  "convex-finance": "https://www.convexfinance.com/",
  yearn: "https://yearn.fi/",
  "yearn-finance": "https://yearn.fi/",
  beefy: "https://app.beefy.com/",
  lido: "https://stake.lido.fi/",
  rocketpool: "https://stake.rocketpool.net/",
  "rocket-pool": "https://stake.rocketpool.net/",
  uniswap: "https://app.uniswap.org/",
  "uniswap-v3": "https://app.uniswap.org/",
  "uniswap-v2": "https://app.uniswap.org/",
  balancer: "https://app.balancer.fi/",
  "balancer-v2": "https://app.balancer.fi/",
  sushiswap: "https://www.sushi.com/",
  gmx: "https://app.gmx.io/",
  "gmx-v2": "https://app.gmx.io/",
  spark: "https://app.spark.fi/",
  "spark-protocol": "https://app.spark.fi/",
  ethena: "https://app.ethena.fi/",
  "ethena-usde": "https://app.ethena.fi/",
  frax: "https://app.frax.finance/",
  fraxlend: "https://app.frax.finance/fraxlend",
  rocketswap: "https://rocketswap.cafe/",
  silo: "https://app.silo.finance/",
  "silo-finance": "https://app.silo.finance/",
  euler: "https://app.euler.finance/",
  "euler-v2": "https://app.euler.finance/",
  velodrome: "https://velodrome.finance/",
  "velodrome-v2": "https://velodrome.finance/",
  aerodrome: "https://aerodrome.finance/",
  "aerodrome-slipstream": "https://aerodrome.finance/",
  camelot: "https://app.camelot.exchange/",
  "camelot-v3": "https://app.camelot.exchange/",
  "trader-joe": "https://traderjoexyz.com/",
  joe: "https://traderjoexyz.com/",
  pancakeswap: "https://pancakeswap.finance/",
  "pancakeswap-amm": "https://pancakeswap.finance/",
  quickswap: "https://quickswap.exchange/",
  rocketpool_eth: "https://stake.rocketpool.net/",
  stargate: "https://stargate.finance/",
  stakewise: "https://app.stakewise.io/",
  swell: "https://app.swellnetwork.io/",
  renzo: "https://app.renzoprotocol.com/",
  eigenlayer: "https://app.eigenlayer.xyz/",
  kelp: "https://kelpdao.xyz/",
  "kelp-dao": "https://kelpdao.xyz/",
  origin: "https://app.originprotocol.com/",
  "origin-ether": "https://app.originprotocol.com/",
  makerdao: "https://app.spark.fi/",
  "sky-savings-rate": "https://app.sky.money/",
  sky: "https://app.sky.money/",
};

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/**
 * Resolve a "deposit here" link for an allocation. Tries the protocol's
 * official app first, falls back to the DeFiLlama Yields page for the pool —
 * which always exists and routes to the right place.
 */
export function getDepositUrl(protocolName: string, poolId: string): string {
  const slug = slugify(protocolName);
  const direct = PROTOCOL_APP_URLS[slug];
  if (direct) return direct;
  // Try a coarser match (drop trailing version: "morpho-blue" → "morpho")
  const coarser = slug.split("-")[0];
  if (PROTOCOL_APP_URLS[coarser]) return PROTOCOL_APP_URLS[coarser];
  return `https://defillama.com/yields/pool/${poolId}`;
}
