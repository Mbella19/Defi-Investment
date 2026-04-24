"use client";

import { useState } from "react";
import { TabBar, Eyebrow } from "@/components/sovereign";
import SimulatorView from "@/components/views/SimulatorView";
import RiskView from "@/components/views/RiskView";

type Tab = "simulator" | "risk";

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>("simulator");

  return (
    <div>
      <div style={{ padding: "32px 48px 0" }}>
        <Eyebrow>Tools / Analysis Lab</Eyebrow>
        <TabBar
          tabs={[
            { id: "simulator", label: "Yield Simulator" },
            { id: "risk", label: "Risk Lab" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "simulator" ? <SimulatorView /> : null}
      {tab === "risk" ? <RiskView /> : null}
    </div>
  );
}
