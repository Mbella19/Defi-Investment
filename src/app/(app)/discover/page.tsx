"use client";

import { useState } from "react";
import { TabBar, Eyebrow } from "@/components/sovereign";
import ScannerView, { type ScanCriteria } from "@/components/views/ScannerView";
import ResultsView from "@/components/views/ResultsView";
import CompareView from "@/components/views/CompareView";
import StrategyView from "@/components/views/StrategyView";

type Tab = "browse" | "compare" | "strategy";

function BrowseTab() {
  const [criteria, setCriteria] = useState<ScanCriteria | null>(null);

  if (!criteria) {
    return <ScannerView onScan={setCriteria} />;
  }
  return (
    <ResultsView
      budget={criteria.budget}
      risk={criteria.risk}
      asset={criteria.asset}
      chain={criteria.chain}
      onBack={() => setCriteria(null)}
    />
  );
}

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>("browse");

  return (
    <div>
      <div style={{ padding: "32px 48px 0" }}>
        <Eyebrow>Discover / Find Yield</Eyebrow>
        <TabBar
          tabs={[
            { id: "browse", label: "Browse Pools" },
            { id: "compare", label: "Compare" },
            { id: "strategy", label: "AI Strategy" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "browse" ? <BrowseTab /> : null}
      {tab === "compare" ? <CompareView /> : null}
      {tab === "strategy" ? <StrategyView /> : null}
    </div>
  );
}
