import { Sidebar } from "@/components/sovereign/Sidebar";
import { Topbar } from "@/components/sovereign/Topbar";
import { MobileTab } from "@/components/sovereign/MobileTab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-col" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar />
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
      <MobileTab />
    </div>
  );
}
