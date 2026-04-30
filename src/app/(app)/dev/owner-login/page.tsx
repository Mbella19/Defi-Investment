"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { CommandStrip } from "@/components/site/ui";
import { useSiweAuth } from "@/hooks/useSiweAuth";
import { usePlan } from "@/hooks/usePlan";

export default function OwnerLoginPage() {
  const router = useRouter();
  const plan = usePlan();
  const { status: authStatus, refresh: refreshAuth } = useSiweAuth();
  const [wallet, setWallet] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/dev-login", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { enabled?: boolean; owners?: string[] }) => {
        if (cancelled) return;
        setEnabled(d.enabled === true);
        // Auto-fill the first owner wallet so the Sign-in button is
        // immediately enabled. The user can override by typing.
        if (d.owners && d.owners.length > 0) {
          setWallet(d.owners[0]);
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        wallet?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `dev-login ${res.status}`);
      setDone(true);
      // Order matters: refresh SIWE state first so the provider sees the new
      // cookie and flips to "authed" before we navigate. Otherwise the next
      // page renders against stale "needs-signature" state and shows the
      // sign-in gate even though the cookie is valid.
      await refreshAuth();
      await plan.refetch();
      setTimeout(() => {
        router.push("/account/alerts");
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Dev / Owner sign-in</p>
          <h1>Skip the hardware-signing dance.</h1>
          <p>
            Localhost-only shortcut so the project owner can issue a SIWE
            session for any wallet listed in <code>OWNER_WALLETS</code> without
            actually signing on the wallet. Useful when your hardware wallet is
            unplugged, locked, or fighting WebHID.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/00.dev-login"
        items={[
          {
            label: "endpoint",
            value: enabled === null ? "checking" : enabled ? "enabled" : "disabled",
            tone: enabled ? "ok" : enabled === false ? "danger" : "warn",
          },
          {
            label: "session",
            value: authStatus === "authed" ? "active" : "none",
            tone: authStatus === "authed" ? "ok" : "warn",
          },
          {
            label: "tier",
            value: plan.tier,
            tone: plan.tier === "ultra" ? "warn" : plan.tier === "pro" ? "ok" : "info",
          },
        ]}
      />

      <div className="boost-panel" style={{ marginTop: 22, maxWidth: 640 }}>
        {enabled === null ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            <Loader2 size={14} className="spinning" aria-hidden="true" /> Checking
            whether dev sign-in is enabled…
          </p>
        ) : enabled === false ? (
          <div>
            <ShieldAlert size={22} aria-hidden="true" style={{ color: "var(--coral)" }} />
            <h2 style={{ marginTop: 8 }}>Dev sign-in is disabled</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
              The endpoint refuses unless both conditions are met:
            </p>
            <ul style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>
              <li><code>VERCEL</code> is not set to <code>1</code> (i.e. you&apos;re not on a real prod deploy)</li>
              <li><code>ENABLE_DEV_LOGIN=true</code> is in <code>.env.local</code></li>
            </ul>
            <p style={{ color: "var(--soft)", fontSize: 12, marginTop: 12 }}>
              Restart the server after editing <code>.env.local</code> for changes to take effect.
            </p>
          </div>
        ) : done ? (
          <div>
            <CheckCircle2 size={22} aria-hidden="true" style={{ color: "var(--mint)" }} />
            <h2 style={{ marginTop: 8 }}>Signed in</h2>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              Redirecting to alerts settings…
            </p>
          </div>
        ) : (
          <div>
            <ShieldCheck size={22} aria-hidden="true" style={{ color: "var(--mint)" }} />
            <h2 style={{ marginTop: 8 }}>Owner sign-in</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
              Paste any wallet listed in <code>OWNER_WALLETS</code>. We&apos;ll
              issue a session cookie for it without prompting your wallet.
            </p>
            <div className="alerts-form-row" style={{ marginTop: 14 }}>
              <input
                className="address-input"
                type="text"
                spellCheck={false}
                placeholder="0x35de0b4157ecb2037ab1041d2333981e81baef24"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              <button
                type="button"
                className="primary-button"
                onClick={login}
                disabled={busy || wallet.trim().length < 42}
              >
                {busy ? (
                  <Loader2 size={14} className="spinning" aria-hidden="true" />
                ) : (
                  <KeyRound size={14} aria-hidden="true" />
                )}
                Sign in
              </button>
            </div>
            {error ? (
              <div className="checkout-status tone-danger" style={{ marginTop: 12 }}>
                {error}
              </div>
            ) : null}
            <p style={{ color: "var(--soft)", fontSize: 11, marginTop: 16 }}>
              Hard guards: refuses on Vercel, requires <code>ENABLE_DEV_LOGIN=true</code>,
              wallet must be in <code>OWNER_WALLETS</code>, and <code>SESSION_SECRET</code>{" "}
              must be set. There is no path for an external user to grant themselves a
              session via this endpoint.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/account/alerts" className="ghost-button">
          ← Back to alerts settings
        </Link>
      </div>
    </div>
  );
}
