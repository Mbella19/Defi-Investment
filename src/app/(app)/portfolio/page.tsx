"use client";

import { useState } from "react";
import { TabBar, Eyebrow } from "@/components/sovereign";
import HoldingsView from "@/components/views/HoldingsView";
import StrategiesView from "@/components/views/StrategiesView";
import MonitorView from "@/components/views/MonitorView";

type Tab = "holdings" | "strategies" | "monitor";

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("holdings");

  return (
    <div>
      <div style={{ padding: "32px 48px 0" }}>
        <Eyebrow>Portfolio / Your Capital</Eyebrow>
        <TabBar
          tabs={[
            { id: "holdings", label: "Holdings" },
            { id: "strategies", label: "Active Strategies" },
            { id: "monitor", label: "Live Monitor" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "holdings" ? <HoldingsView /> : null}
      {tab === "strategies" ? <StrategiesView /> : null}
      {tab === "monitor" ? <MonitorView /> : null}
    </div>
  );
}
