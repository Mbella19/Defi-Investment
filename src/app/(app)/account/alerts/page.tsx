"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { CommandStrip } from "@/components/site/ui";
import { useAccount, useDisconnect } from "wagmi";
import { useSiweAuth } from "@/hooks/useSiweAuth";
import { usePlan } from "@/hooks/usePlan";

type ChannelKind = "email" | "telegram" | "slack" | "discord";

interface UserChannel {
  walletAddress: string;
  channel: ChannelKind;
  endpoint: string;
  verified: boolean;
  enabled: boolean;
  createdAt: string;
  verifiedAt: string | null;
}

interface ChannelsResponse {
  channels: UserChannel[];
  allowedChannels: ChannelKind[];
  tier: "free" | "pro" | "ultra";
  config: { email: boolean; telegram: boolean };
}

interface StartResponse {
  channel: ChannelKind;
  status: "pending_code" | "pending_telegram" | "verified";
  message: string;
  telegramDeeplink?: string;
  telegramToken?: string;
}

type AddState =
  | { kind: "idle" }
  | { kind: "form"; channel: ChannelKind }
  | { kind: "code"; channel: "email"; endpoint: string; message: string }
  | {
      kind: "telegram";
      deeplink: string;
      token: string;
      message: string;
      polling: boolean;
    };

const CHANNEL_META: Record<
  ChannelKind,
  { label: string; icon: typeof Mail; tone: string; blurb: string; placeholder: string }
> = {
  email: {
    label: "Email",
    icon: Mail,
    tone: "#6ee7b7",
    blurb: "Plain inbox delivery. We'll send you a 6-digit code to confirm.",
    placeholder: "you@domain.com",
  },
  telegram: {
    label: "Telegram",
    icon: Send,
    tone: "#60a5fa",
    blurb: "Chat with our bot. We'll know which chat you are when you /start it.",
    placeholder: "",
  },
  slack: {
    label: "Slack",
    icon: MessageSquare,
    tone: "#fbbf24",
    blurb:
      "Paste a Slack incoming-webhook URL from your workspace. We'll post a confirmation.",
    placeholder: "https://hooks.slack.com/services/…",
  },
  discord: {
    label: "Discord",
    icon: MessageSquare,
    tone: "#a78bfa",
    blurb:
      "Paste a Discord webhook URL from your server's channel settings. We'll post a confirmation.",
    placeholder: "https://discord.com/api/webhooks/…",
  },
};

export default function AlertsSettingsPage() {
  const { status: authStatus, signIn, error: siweError } = useSiweAuth();
  const isAuthed = authStatus === "authed";
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const plan = usePlan();
  const [data, setData] = useState<ChannelsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [add, setAdd] = useState<AddState>({ kind: "idle" });
  const [endpoint, setEndpoint] = useState("");
  const [code, setCode] = useState("");
  const [autoSignAttempted, setAutoSignAttempted] = useState(false);

  // If wagmi connected but SIWE session is missing, transparently re-prompt
  // signing once. Wallet shown in the topbar → user already considers
  // themselves "signed in"; we shouldn't make them click another button just
  // to view their own settings. The provider's auto-prompt throttle won't
  // re-fire after the user dismissed it, so we call signIn() directly here.
  useEffect(() => {
    if (autoSignAttempted) return;
    if (authStatus === "checking" || authStatus === "signing") return;
    if (!isConnected) return;
    if (isAuthed) return;
    setAutoSignAttempted(true);
    void signIn().catch(() => {
      /* user dismissed — fall through to the explicit sign-in card */
    });
  }, [authStatus, isAuthed, isConnected, signIn, autoSignAttempted]);

  const fetchChannels = useCallback(async () => {
    if (!isAuthed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/channels", { cache: "no-store" });
      if (!res.ok) throw new Error(`Channels ${res.status}`);
      const json = (await res.json()) as ChannelsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setBusy(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  // Telegram polling — every 4s while the user is in the telegram-pending state.
  useEffect(() => {
    if (add.kind !== "telegram") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/account/channels/telegram-poll", {
          method: "POST",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { connected: boolean };
        if (json.connected) {
          setAdd({ kind: "idle" });
          setEndpoint("");
          await fetchChannels();
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [add, fetchChannels]);

  async function startSetup(channel: ChannelKind) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, endpoint: endpoint.trim() }),
      });
      const json = (await res.json()) as StartResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Setup ${res.status}`);
      if (json.status === "verified") {
        setAdd({ kind: "idle" });
        setEndpoint("");
        await fetchChannels();
      } else if (json.status === "pending_code" && json.channel === "email") {
        setAdd({
          kind: "code",
          channel: "email",
          endpoint: endpoint.trim(),
          message: json.message,
        });
      } else if (
        json.status === "pending_telegram" &&
        json.telegramDeeplink &&
        json.telegramToken
      ) {
        setAdd({
          kind: "telegram",
          deeplink: json.telegramDeeplink,
          token: json.telegramToken,
          message: json.message,
          polling: true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (add.kind !== "code") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/channels/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: add.channel, code: code.trim() }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Verify ${res.status}`);
      setAdd({ kind: "idle" });
      setEndpoint("");
      setCode("");
      await fetchChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeChannel(channel: ChannelKind) {
    if (!confirm(`Remove the ${CHANNEL_META[channel].label} channel?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/channels/${channel}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Remove ${res.status}`);
      await fetchChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleChannel(channel: ChannelKind, enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/channels/${channel}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`Toggle ${res.status}`);
      await fetchChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  const channelsByKind = useMemo(() => {
    const m = new Map<ChannelKind, UserChannel>();
    for (const ch of data?.channels ?? []) m.set(ch.channel, ch);
    return m;
  }, [data]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Account / Alerts</p>
          <h1>Get pinged where you live.</h1>
          <p>
            Connect the channels Sovereign should use when an alert fires on one
            of your active positions. Higher tiers unlock more channels.
            Free wallets use Discord if configured at the server level.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/08.alerts"
        items={[
          {
            label: "tier",
            value: data?.tier ?? plan.tier,
            tone: data?.tier === "ultra" ? "warn" : data?.tier === "pro" ? "ok" : "info",
          },
          {
            label: "configured",
            value: String(data?.channels.filter((c) => c.verified).length ?? 0),
            tone: "ok",
          },
          {
            label: "delivery",
            value: "non-custodial",
            tone: "info",
          },
        ]}
      />

      {!isAuthed ? (
        <div className="paywall-card" style={{ marginTop: 22 }}>
          <div className="paywall-icon">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {authStatus === "signing"
              ? "Confirm in your wallet"
              : authStatus === "checking"
                ? "Checking session"
                : !isConnected
                  ? "Connect a wallet"
                  : authStatus === "error"
                    ? "Authorization failed"
                    : "One-time wallet authorization"}
          </p>
          <h2>
            {authStatus === "signing"
              ? "Approve the signature request"
              : authStatus === "checking"
                ? "Loading your account…"
                : !isConnected
                  ? "Connect your wallet to continue"
                  : authStatus === "error"
                    ? "Try again"
                    : "Authorize this wallet"}
          </h2>
          <p>
            {authStatus === "signing"
              ? "Check your wallet popup — there's a signature request waiting. It doesn't authorize any transaction; it just proves you own this address."
              : !isConnected
                ? "Alert channels are scoped to your wallet. Connect once and your delivery setup persists across sessions."
                : authStatus === "error"
                  ? siweError ?? "Wallet didn't return a signature. If MetaMask is hiding behind the browser, click its extension icon to bring it forward."
                  : "Your wallet is connected, but we need a one-time signature to read your channel settings. The signature doesn't authorize any transaction."}
          </p>
          {authStatus !== "signing" && authStatus !== "checking" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => signIn().catch(() => {})}
              >
                {!isConnected ? "Connect wallet" : "Authorize wallet"}
              </button>
              {isConnected ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    disconnect();
                    setAutoSignAttempted(false);
                  }}
                  title="Disconnect and reconnect — useful if MetaMask got confused"
                >
                  Disconnect &amp; retry
                </button>
              ) : null}
            </div>
          ) : null}
          {authStatus === "signing" ? (
            <p style={{ fontSize: 12, color: "var(--soft)", marginTop: 14 }}>
              Don&apos;t see the wallet popup? Click the MetaMask extension icon to surface it.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="alerts-layout">
          <section className="boost-panel">
            <div className="alerts-section-head">
              <div>
                <p className="eyebrow">Channels</p>
                <h2>Where to send alerts</h2>
              </div>
              {error ? (
                <div className="checkout-status tone-danger" style={{ flex: 1, marginLeft: 16 }}>
                  {error}
                </div>
              ) : null}
            </div>

            <div className="channel-list">
              {(Object.keys(CHANNEL_META) as ChannelKind[]).map((kind) => {
                const meta = CHANNEL_META[kind];
                const Icon = meta.icon;
                const ch = channelsByKind.get(kind);
                const allowed = data?.allowedChannels.includes(kind) ?? false;
                const serverConfigOk =
                  kind === "email"
                    ? data?.config.email ?? false
                    : kind === "telegram"
                      ? data?.config.telegram ?? false
                      : true;
                return (
                  <article
                    key={kind}
                    className="channel-row"
                    style={{ "--ch-tone": meta.tone } as React.CSSProperties}
                  >
                    <div className="channel-icon">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div className="channel-meta">
                      <div className="channel-meta-head">
                        <strong>{meta.label}</strong>
                        {ch?.verified ? (
                          <span className="channel-tag is-on">
                            <CheckCircle2 size={12} aria-hidden="true" /> Verified
                          </span>
                        ) : null}
                        {!allowed ? (
                          <span className="channel-tag is-locked">
                            {data?.tier === "free" ? "Pro+" : "Ultra"}
                          </span>
                        ) : null}
                        {!serverConfigOk && allowed && !ch ? (
                          <span className="channel-tag is-warn">Server unset</span>
                        ) : null}
                      </div>
                      <span className="channel-blurb">
                        {ch?.verified
                          ? `Delivering to ${maskEndpoint(kind, ch.endpoint)}`
                          : meta.blurb}
                      </span>
                    </div>
                    <div className="channel-actions">
                      {ch?.verified ? (
                        <>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => toggleChannel(kind, !ch.enabled)}
                            disabled={busy}
                          >
                            {ch.enabled ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => removeChannel(kind)}
                            disabled={busy}
                            aria-label="Remove channel"
                          >
                            <Trash2 size={14} aria-hidden="true" /> Remove
                          </button>
                        </>
                      ) : !allowed ? (
                        <Link
                          href={data?.tier === "free" ? "/plans/checkout?tier=pro" : "/plans/checkout?tier=ultra"}
                          className="ghost-button"
                        >
                          Upgrade <ChevronRight size={14} aria-hidden="true" />
                        </Link>
                      ) : !serverConfigOk ? (
                        <span style={{ fontSize: 12, color: "var(--soft)" }}>
                          Operator setup required
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="blue-button"
                          onClick={() => {
                            setAdd({ kind: "form", channel: kind });
                            setEndpoint("");
                            setCode("");
                            setError(null);
                          }}
                          disabled={busy}
                        >
                          <Plus size={14} aria-hidden="true" /> Connect
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {add.kind === "form" ? (
            <section className="boost-panel">
              <div className="alerts-section-head">
                <div>
                  <p className="eyebrow">Connect · {CHANNEL_META[add.channel].label}</p>
                  <h2>{add.channel === "telegram" ? "Open the bot to confirm" : "Enter your endpoint"}</h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setAdd({ kind: "idle" })}
                >
                  <X size={14} aria-hidden="true" /> Cancel
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
                {CHANNEL_META[add.channel].blurb}
              </p>
              {add.channel === "telegram" ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => startSetup("telegram")}
                  disabled={busy}
                >
                  {busy ? <Loader2 size={14} className="spinning" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                  Generate connection link
                </button>
              ) : (
                <div className="alerts-form-row">
                  <input
                    className="address-input"
                    type={add.channel === "email" ? "email" : "url"}
                    placeholder={CHANNEL_META[add.channel].placeholder}
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => startSetup(add.channel)}
                    disabled={busy || endpoint.trim().length < 4}
                  >
                    {busy ? <Loader2 size={14} className="spinning" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                    {add.channel === "email" ? "Send code" : "Connect"}
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {add.kind === "code" ? (
            <section className="boost-panel">
              <div className="alerts-section-head">
                <div>
                  <p className="eyebrow">Verify email</p>
                  <h2>Enter the 6-digit code</h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setAdd({ kind: "idle" })}
                >
                  <X size={14} aria-hidden="true" /> Cancel
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>{add.message}</p>
              <div className="alerts-form-row">
                <input
                  className="address-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  style={{ flex: 1, fontFamily: "var(--font-mono)", letterSpacing: "0.2em", fontSize: 18 }}
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={submitCode}
                  disabled={busy || code.length < 4}
                >
                  {busy ? <Loader2 size={14} className="spinning" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                  Verify
                </button>
              </div>
            </section>
          ) : null}

          {add.kind === "telegram" ? (
            <section className="boost-panel">
              <div className="alerts-section-head">
                <div>
                  <p className="eyebrow">Connect · Telegram</p>
                  <h2>Open the link, return here</h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setAdd({ kind: "idle" })}
                >
                  <X size={14} aria-hidden="true" /> Cancel
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>{add.message}</p>
              <a
                href={add.deeplink}
                target="_blank"
                rel="noopener noreferrer"
                className="primary-button"
                style={{ display: "inline-flex" }}
              >
                <Send size={14} aria-hidden="true" /> Open Telegram
                <ExternalLink size={12} aria-hidden="true" />
              </a>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 13 }}>
                <Loader2 size={14} className="spinning" aria-hidden="true" />
                Watching for your /start message…
              </div>
              <details style={{ marginTop: 14, color: "var(--soft)", fontSize: 12 }}>
                <summary style={{ cursor: "pointer" }}>If the deeplink doesn&apos;t open</summary>
                <p style={{ marginTop: 8, lineHeight: 1.55 }}>
                  Open Telegram, search for the Sovereign bot, and send it this exact
                  message:
                </p>
                <code
                  style={{
                    display: "block",
                    marginTop: 8,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  /start {add.token}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`/start ${add.token}`)}
                  className="ghost-button"
                  style={{ marginTop: 10 }}
                >
                  <Copy size={12} aria-hidden="true" /> Copy
                </button>
              </details>
            </section>
          ) : null}

          <section className="boost-panel">
            <p className="eyebrow">What triggers alerts</p>
            <h2 style={{ marginTop: 4 }}>The same rules every tier runs on</h2>
            <ul className="alerts-event-list">
              <li><Bell size={14} /> APY collapse on a position you hold</li>
              <li><Bell size={14} /> TVL drain or bank-run pattern across a protocol</li>
              <li><Bell size={14} /> Contract pause flag flipped on-chain</li>
              <li><Bell size={14} /> Exploit alert matched to a protocol you&apos;re in</li>
              <li><Bell size={14} /> Deployer downgraded by ground-truth review</li>
            </ul>
            <p style={{ color: "var(--soft)", fontSize: 12, marginTop: 14 }}>
              Alerts deduplicate on a 24h window per (strategy, pool, type) so you
              never get pinged twice for the same event in the same day.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function maskEndpoint(kind: ChannelKind, endpoint: string): string {
  if (kind === "email") {
    const [user, domain] = endpoint.split("@");
    if (!user || !domain) return endpoint;
    const masked =
      user.length <= 2 ? user : user.slice(0, 2) + "•".repeat(Math.max(1, user.length - 2));
    return `${masked}@${domain}`;
  }
  if (kind === "telegram") return `Telegram chat #${endpoint}`;
  if (kind === "slack" || kind === "discord") {
    return endpoint.replace(/\/services\/.*/, "/services/•••").replace(/\/api\/webhooks\/.*/, "/api/webhooks/•••");
  }
  return endpoint;
}
