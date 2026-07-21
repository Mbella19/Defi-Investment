import "server-only";
import { log } from "@/lib/log";
import { findPair } from "./config";
import {
  clearPendingQuoteTx,
  confirmQuoteAndActivate,
  listReconcilableQuotes,
  markQuoteStatus,
  TxAlreadyClaimedError,
} from "./quote";
import { verifyTransaction } from "./verify";

/**
 * Server-side payment self-healing. Users regularly submit a tx hash before
 * it has enough confirmations, then close the tab — without this sweep their
 * payment would sit on-chain with no subscription. Runs from the in-process
 * scheduler (and the external cron route) every 15 minutes over pending
 * quotes that carry a tx hash.
 */
export async function reconcilePendingPayments(): Promise<{
  checked: number;
  confirmed: number;
}> {
  const quotes = listReconcilableQuotes();
  let confirmed = 0;

  for (const quote of quotes) {
    const txHash = quote.txHash;
    const pair = findPair(quote.chain, quote.token);
    if (!txHash || !pair) continue;
    if (
      quote.chainId === null ||
      pair.chainId !== quote.chainId ||
      (pair.contract?.toLowerCase() ?? null) !== (quote.tokenContract?.toLowerCase() ?? null)
    ) {
      markQuoteStatus(quote, "failed");
      continue;
    }

    try {
      const result = await verifyTransaction({
        pair,
        txHash,
        expectedRecipient: quote.recipientAddress,
        expectedAmount: quote.amountToken,
        expectedSender: quote.wallet,
        notBefore: quote.createdAt,
        notAfter: quote.expiresAt,
      });
      if (!result.ok) {
        if (!result.retryable) {
          clearPendingQuoteTx(quote);
          log.warn("reconciler", "payment verification rejected", {
            quoteId: quote.id,
            reason: result.reason,
          });
        }
        continue;
      }
      confirmQuoteAndActivate(quote, txHash, result.observed);
      confirmed += 1;
      log.info("reconciler", "auto-confirmed payment", {
        quoteId: quote.id,
        wallet: quote.wallet,
        tier: quote.tier,
        chain: quote.chain,
        token: quote.token,
      });
    } catch (err) {
      if (err instanceof TxAlreadyClaimedError) {
        markQuoteStatus(quote, "failed");
        log.warn("reconciler", "tx already claimed elsewhere — quote marked failed", {
          quoteId: quote.id,
        });
        continue;
      }
      log.warn("reconciler", "reconcile attempt failed", {
        quoteId: quote.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked: quotes.length, confirmed };
}
