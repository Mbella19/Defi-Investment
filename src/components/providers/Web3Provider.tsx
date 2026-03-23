"use client";

import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wallet/config";
import { useTheme } from "@/components/ThemeProvider";

const queryClient = new QueryClient();

const sovereignLight = lightTheme({
  accentColor: "#00D4AA",
  accentColorForeground: "#00110D",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});
sovereignLight.colors.connectButtonBackground = "#ffffff";
sovereignLight.colors.connectButtonInnerBackground = "#f2f3f5";
sovereignLight.colors.modalBackground = "#ececef";
sovereignLight.colors.modalBorder = "#d7dade";
sovereignLight.fonts.body = "Inter, system-ui, sans-serif";

const sovereignDark = darkTheme({
  accentColor: "#00D4AA",
  accentColorForeground: "#00110D",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});
sovereignDark.colors.connectButtonBackground = "#222228";
sovereignDark.colors.connectButtonInnerBackground = "#111113";
sovereignDark.colors.modalBackground = "#0a0a0b";
sovereignDark.colors.modalBorder = "#2a2a32";
sovereignDark.fonts.body = "Inter, system-ui, sans-serif";

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme === "dark" ? sovereignDark : sovereignLight}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
