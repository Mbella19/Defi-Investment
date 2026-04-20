import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, optimism, polygon, base, bsc, avalanche } from "wagmi/chains";
import { http } from "wagmi";

export const SUPPORTED_CHAINS = [mainnet, arbitrum, optimism, polygon, base, bsc, avalanche] as const;

export const config = getDefaultConfig({
  appName: "Sovereign Investment Group",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [mainnet, arbitrum, optimism, polygon, base, bsc, avalanche],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
  },
});
