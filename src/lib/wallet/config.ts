import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, optimism, polygon, base, bsc, avalanche } from "wagmi/chains";
import { http } from "wagmi";
import { getRpcUrl } from "@/lib/rpc";

export const SUPPORTED_CHAINS = [mainnet, arbitrum, optimism, polygon, base, bsc, avalanche] as const;

const RAW_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
// Fail-fast in production builds: an unset / placeholder projectId means
// WalletConnect rejects every connection at runtime, leaving the user with a
// cryptic 403. Crashing module load surfaces the misconfiguration during
// `next build` instead. Local dev keeps the placeholder for offline parity.
if (
  process.env.NODE_ENV === "production" &&
  (!RAW_PROJECT_ID || RAW_PROJECT_ID === "demo")
) {
  throw new Error(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID must be set to a real id from cloud.walletconnect.com — got " +
      (RAW_PROJECT_ID ? JSON.stringify(RAW_PROJECT_ID) : "(unset)"),
  );
}
const projectId = RAW_PROJECT_ID || "demo";

export const config = getDefaultConfig({
  appName: "Sovereign",
  projectId,
  chains: [mainnet, arbitrum, optimism, polygon, base, bsc, avalanche],
  transports: {
    [mainnet.id]: http(getRpcUrl(mainnet.id)),
    [arbitrum.id]: http(getRpcUrl(arbitrum.id)),
    [optimism.id]: http(getRpcUrl(optimism.id)),
    [polygon.id]: http(getRpcUrl(polygon.id)),
    [base.id]: http(getRpcUrl(base.id)),
    [bsc.id]: http(getRpcUrl(bsc.id)),
    [avalanche.id]: http(getRpcUrl(avalanche.id)),
  },
});
