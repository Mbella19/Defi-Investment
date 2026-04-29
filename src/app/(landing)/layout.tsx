import ClientWeb3Provider from "@/components/providers/ClientWeb3Provider";
import { SiteShell } from "@/components/site/SiteShell";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientWeb3Provider>
      <SiteShell>{children}</SiteShell>
    </ClientWeb3Provider>
  );
}
