import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Risk summary — Sovereign",
  description:
    "Mandatory FCA risk summary for cryptoasset and DeFi yield activities discussed on Sovereign. Read this before you act.",
};

export default function RiskSummaryPage() {
  return (
    <div className="page risk-page">
      <Link href="/" className="ghost-button" style={{ alignSelf: "flex-start" }}>
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>

      <div className="page-title" style={{ marginTop: 18 }}>
        <p className="eyebrow">Risk summary · estimated reading time 2 mins</p>
        <h1>Read this before you act on anything you see on Sovereign.</h1>
        <p>
          The UK Financial Conduct Authority (FCA) requires firms communicating
          cryptoasset-related promotions to UK consumers to publish a clear summary of the
          risks involved. This page is that summary. Sovereign is a research, monitoring,
          and analytics tool — we do not provide regulated investment advice, we do not
          custody your funds, and we do not execute transactions on your behalf.
        </p>
      </div>

      <section className="risk-banner-block">
        <AlertTriangle size={22} aria-hidden="true" />
        <p>
          <strong>
            Don&apos;t invest unless you&apos;re prepared to lose all the money you invest.
          </strong>{" "}
          Cryptoassets and DeFi yield positions are high-risk investments. You should not
          expect to be protected if something goes wrong.
        </p>
      </section>

      <section className="risk-list-block">
        <h2>1. You could lose all the money you invest</h2>
        <p>
          The price of cryptoassets is volatile. They can lose value rapidly and have no
          underlying claim, deposit guarantee, or central-bank backstop. Yield-generating
          positions on DeFi protocols can be drained by exploits, governance attacks, oracle
          manipulation, bridge failures, or smart-contract bugs — and there is generally no
          way to recover the funds once a protocol is compromised.
        </p>

        <h2>2. You will not be protected if something goes wrong</h2>
        <p>
          Cryptoasset and DeFi activities are not protected in the same way as bank deposits
          or regulated investment products. The Financial Services Compensation Scheme
          (FSCS) does not cover losses on cryptoassets or DeFi positions. The Financial
          Ombudsman Service (FOS) typically cannot help you if a DeFi protocol fails, a
          counterparty becomes insolvent, your wallet is compromised, or a transaction is
          irreversibly mis-sent. You bear the full financial risk of every position you
          take.
        </p>

        <h2>3. The cryptoasset market is volatile and largely unregulated</h2>
        <p>
          Yields and prices change minute by minute. APYs displayed by Sovereign are
          floating market rates, not guarantees — they can fall to zero or invert. Stablecoins
          can de-peg. Liquidity can vanish. Even highly-rated, multi-audited protocols have
          historically been exploited. Past performance never predicts future returns, and
          analyst scores are not assurances of safety.
        </p>

        <h2>4. Smart-contract and counterparty risk</h2>
        <p>
          Every DeFi position depends on the underlying smart contract executing as intended
          and the protocol&apos;s operators (where applicable) acting honestly. Contracts
          can contain undiscovered bugs. Operators can rug-pull, freeze withdrawals, or be
          coerced. Sovereign&apos;s security review reduces the chance of catastrophic
          failure but cannot eliminate it. Treat every position as potentially recoverable to
          zero.
        </p>

        <h2>5. The complexity of DeFi can hide risk</h2>
        <p>
          DeFi yields often come from layered strategies — lending, liquidity provision,
          auto-compounding, leveraged loops, cross-chain bridges. Each layer adds risk that
          is not obvious from the headline APY. If you do not understand how a position
          earns its yield, you cannot judge whether the yield compensates for the risk.
        </p>

        <h2>6. Sovereign is a research and monitoring tool, not an investment adviser</h2>
        <p>
          Conviction scores, strategy proposals, and security reviews published by Sovereign
          are informational and may contain errors. Sovereign does not provide regulated
          investment advice and is not authorised or regulated by the Financial Conduct
          Authority. The decision to deploy capital — and the financial responsibility for
          that decision — is entirely yours. Do your own research, only invest amounts you
          can afford to lose, and consider speaking to an FCA-authorised independent
          financial adviser before making any cryptoasset investment.
        </p>

        <h2>7. Take time. Get a second opinion.</h2>
        <p>
          The FCA encourages a 24-hour cooling-off period for first-time crypto investors.
          If you are new to cryptoassets, do not act on a strategy or yield opportunity
          immediately — sleep on it, discuss it with someone you trust, and reread this
          summary. The most expensive position is the one taken in haste.
        </p>

        <h2>If you have a complaint about how this content was promoted to you</h2>
        <p>
          UK consumers who believe a cryptoasset financial promotion has been communicated
          to them in breach of the FCA&apos;s financial promotions regime can contact the
          FCA Consumer Helpline on 0800 111 6768 or report it via{" "}
          <a
            href="https://www.fca.org.uk/consumers/report-scam-unauthorised-firm"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--blue)", textDecoration: "underline" }}
          >
            fca.org.uk
          </a>
          .
        </p>
      </section>

      <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" className="ghost-button">
          <ArrowLeft size={16} aria-hidden="true" /> Back to home
        </Link>
        <Link href="/plans" className="secondary-button">
          See plans
        </Link>
      </div>
    </div>
  );
}
