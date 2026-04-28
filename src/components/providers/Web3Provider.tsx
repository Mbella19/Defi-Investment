"use client";

import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wallet/config";
import { SiweAuthProvider } from "@/hooks/useSiweAuth";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const sovereignDark = darkTheme({
  accentColor: "#5AE4D4",
  accentColorForeground: "#07080C",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});
sovereignDark.colors.connectButtonBackground = "#0D1015";
sovereignDark.colors.connectButtonInnerBackground = "#12161D";
sovereignDark.colors.modalBackground = "#07080C";
sovereignDark.colors.modalBorder = "#2A313D";
sovereignDark.fonts.body = "Inter, system-ui, sans-serif";

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={sovereignDark}>
          <SiweAuthProvider>{children}</SiweAuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
