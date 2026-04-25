import { Sidebar } from "@/components/sovereign/Sidebar";
import { Topbar } from "@/components/sovereign/Topbar";
import { MobileTab } from "@/components/sovereign/MobileTab";
import ClientWeb3Provider from "@/components/providers/ClientWeb3Provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientWeb3Provider>
      <div className="app-shell">
        <Sidebar />
        <div className="main-col" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Topbar />
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        </div>
        <MobileTab />
      </div>
    </ClientWeb3Provider>
  );
}
