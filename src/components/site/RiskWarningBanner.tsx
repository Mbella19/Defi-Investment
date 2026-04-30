import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface RiskWarningBannerProps {
  /** "compact" trims padding for in-page contexts (e.g. checkout). */
  variant?: "default" | "compact";
}

/**
 * FCA-mandated risk warning for qualifying cryptoasset financial promotions
 * (COBS 4.12A / FG23/3). The wording is prescribed by the FCA — do not edit
 * the bold sentence or the "Take 2 mins to learn more" link copy without
 * checking the current handbook text. The link MUST resolve to a risk
 * summary page that meets the FCA's expectations (see /risk).
 */
export function RiskWarningBanner({ variant = "default" }: RiskWarningBannerProps) {
  return (
    <aside
      className={`fca-risk-banner${variant === "compact" ? " is-compact" : ""}`}
      role="region"
      aria-label="High-risk investment warning"
    >
      <div className="fca-risk-banner-inner">
        <span className="fca-risk-banner-icon" aria-hidden="true">
          <AlertTriangle size={18} />
        </span>
        <p>
          <strong>
            Don&apos;t invest unless you&apos;re prepared to lose all the money you invest.
          </strong>{" "}
          Cryptoassets and DeFi yield are high-risk investments and you should not expect to
          be protected if something goes wrong.{" "}
          <Link href="/risk" className="fca-risk-banner-link">
            Take 2 mins to learn more
          </Link>
          .
        </p>
      </div>
    </aside>
  );
}
