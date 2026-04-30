"use client";

import Link from "next/link";
import { Crown, Lock, Sparkles, Zap } from "lucide-react";
import type { Tier } from "@/hooks/usePlan";

interface PaywallProps {
  title: string;
  body: string;
  requiredTier: "pro" | "ultra";
  currentTier: Tier;
  feature?: string;
}

const ICON_BY_TIER = {
  pro: Zap,
  ultra: Crown,
} as const;

export function Paywall({ title, body, requiredTier, currentTier, feature }: PaywallProps) {
  const Icon = ICON_BY_TIER[requiredTier];
  return (
    <div className="paywall-card">
      <div className="paywall-icon">
        <Lock size={20} aria-hidden="true" />
      </div>
      <p className="eyebrow">
        {feature ? `${feature} · ` : ""}
        {requiredTier === "ultra" ? "Ultra plan" : "Pro plan"}
      </p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="paywall-cta-row">
        <Link
          href={`/plans/checkout?tier=${requiredTier}`}
          className={requiredTier === "ultra" ? "primary-button" : "wallet-button"}
        >
          <Icon size={17} aria-hidden="true" />
          Upgrade to {requiredTier === "ultra" ? "Ultra" : "Pro"}
        </Link>
        <Link href="/plans" className="ghost-button">
          <Sparkles size={16} aria-hidden="true" />
          Compare plans
        </Link>
      </div>
      {currentTier !== "free" ? (
        <small className="paywall-note">
          You&apos;re currently on the {currentTier} plan — this feature is available on {requiredTier}.
        </small>
      ) : null}
    </div>
  );
}
