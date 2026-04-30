import { SiteShell } from "@/components/site/SiteShell";

// Web3Provider lives in the root layout (src/app/layout.tsx) so the wallet
// connection and SIWE session ref survive navigation between route groups.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
