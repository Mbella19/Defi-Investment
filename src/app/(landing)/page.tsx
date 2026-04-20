"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Shield,
  BarChart3,
  Zap,
  Brain,
  TrendingUp,
  Lock,
  Globe,
  Mail,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
      {children}
    </div>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative mx-auto w-full max-w-[1320px] px-4 pb-8 pt-8 sm:px-6 lg:px-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[36px] font-black leading-[0.85] tracking-[-0.08em] text-on-surface">
            ST
          </div>
          <div className="pt-0.5 text-xs font-medium uppercase leading-[1.1] tracking-[0.02em] text-on-surface">
            <div>Sovereign</div>
            <div>Terminal</div>
          </div>
        </div>

        <nav className="hidden items-center gap-12 text-sm font-semibold uppercase tracking-[0.04em] text-btn md:flex">
          <a className="transition-opacity hover:opacity-60" href="#features">Features</a>
          <a className="transition-opacity hover:opacity-60" href="#how">How it works</a>
          <a className="transition-opacity hover:opacity-60" href="#stats">Intelligence</a>
          <a className="transition-opacity hover:opacity-60" href="#contact">Contact</a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/scanner"
            className="hidden border border-btn px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-btn transition-all hover:-translate-y-0.5 hover:bg-btn hover:text-white sm:inline-block"
          >
            Launch App
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex items-center justify-center p-2 text-btn md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-b border-outline md:hidden"
          >
            <div className="flex flex-col gap-4 pb-6 pt-6 text-sm font-semibold uppercase tracking-[0.04em] text-btn">
              <a className="transition-opacity hover:opacity-60" href="#features" onClick={() => setMenuOpen(false)}>Features</a>
              <a className="transition-opacity hover:opacity-60" href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
              <a className="transition-opacity hover:opacity-60" href="#stats" onClick={() => setMenuOpen(false)}>Intelligence</a>
              <a className="transition-opacity hover:opacity-60" href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
              <Link
                href="/scanner"
                onClick={() => setMenuOpen(false)}
                className="mt-2 w-full border border-btn px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.04em] text-btn transition-all hover:bg-btn hover:text-white"
              >
                Launch App
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-10">
      <div className="grid min-h-[680px] grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-0">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col justify-center pt-10 lg:pt-0"
        >
          <h1 className="max-w-[520px] text-[56px] font-black leading-[0.93] tracking-[-0.06em] text-on-surface md:text-[80px] lg:text-[88px]">
            The Investment Platform for{" "}
            <span className="text-accent">DeFi</span>
          </h1>

          <p className="mt-8 max-w-[440px] text-[16px] leading-[1.6] text-on-surface-variant">
            Institutional-grade yield analysis powered by AI. Scan 10,000+ pools,
            deep-analyze protocol legitimacy, and build risk-adjusted strategies
            — all in one terminal.
          </p>

          <div className="mt-12 w-full max-w-[480px] border-t border-btn pt-7">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[22px] font-semibold tracking-[-0.04em] text-btn md:text-[28px]">
                Free to use. No wallet needed.
              </div>
              <Link
                href="/scanner"
                className="min-w-[156px] bg-cta px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(255,108,18,0.28)]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Hero visual — abstract shapes (hidden on mobile to prevent overlap) */}
        <div className="relative hidden min-h-[480px] overflow-hidden lg:block lg:min-h-[680px]">
          {/* Glowing orbs */}
          <motion.div
            className="absolute left-[15%] top-[10%] h-[280px] w-[280px] bg-accent/20 blur-[80px]"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-[10%] top-[30%] h-[200px] w-[200px] bg-cta/15 blur-[70px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />

          {/* Floating cards */}
          <motion.div
            className="absolute left-[8%] top-[18%] z-10 w-[260px] border border-outline bg-surface-highest p-6 shadow-[0_24px_48px_rgba(32,50,65,0.08)]"
            animate={{ y: [0, -12, 0], rotate: [0, 0.5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-label/60">
              Projected APY
            </div>
            <div className="mt-2 text-[42px] font-black tracking-[-0.06em] text-accent">
              12.4%
            </div>
            <div className="mt-3 flex gap-3">
              <span className="bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                LOW RISK
              </span>
              <span className="bg-surface-low px-2 py-1 text-xs font-semibold text-on-surface-variant">
                5 POOLS
              </span>
            </div>
          </motion.div>

          <motion.div
            className="absolute right-[5%] top-[12%] z-20 w-[220px] border border-outline bg-surface-highest p-5 shadow-[0_24px_48px_rgba(32,50,65,0.08)]"
            animate={{ y: [0, 10, 0], x: [0, -4, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-label/60">
              AI Verdict
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <span className="text-[18px] font-bold text-on-surface">High Confidence</span>
            </div>
            <div className="mt-2 text-sm text-muted">Score: 92/100</div>
          </motion.div>

          <motion.div
            className="absolute bottom-[15%] left-[20%] z-10 w-[240px] border border-outline bg-surface-highest p-5 shadow-[0_24px_48px_rgba(32,50,65,0.08)]"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-label/60">
              Portfolio Alert
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-cta" />
              <span className="text-[14px] font-bold text-on-surface">APY up +3.2%</span>
            </div>
            <div className="mt-1 text-[13px] text-muted">Aave V3 on Ethereum</div>
          </motion.div>

          {/* Bottom-right text block */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.3 }}
            className="absolute bottom-[6%] right-[4%] z-30 max-w-[200px]"
          >
            <h3 className="text-[36px] font-black leading-[0.95] tracking-[-0.05em] text-on-surface md:text-[44px]">
              Smarter yields start here.
            </h3>
            <Link
              href="#how"
              className="mt-5 inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.06em] text-btn/80 hover:text-btn"
            >
              Learn more
              <span className="h-px w-10 bg-current" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeaturesStrip() {
  const features = [
    {
      title: "AI Strategy Engine",
      body: "Claude Opus deep-analyzes every protocol for legitimacy, audits, team reputation, and TVL stability before recommending.",
      tone: "bg-transparent",
      icon: <Brain className="h-6 w-6" />,
    },
    {
      title: "Risk Modeling",
      body: "Value at Risk, Sharpe ratio, stress tests, correlation matrices — quantitative tools used by institutional investors.",
      tone: "bg-accent",
      icon: <BarChart3 className="h-6 w-6" />,
    },
    {
      title: "Yield Scanner",
      body: "Scan 10,000+ yield pools across 120+ chains in real-time. Filter by APY, TVL, risk, and asset type instantly.",
      tone: "bg-lime",
      icon: <TrendingUp className="h-6 w-6" />,
      giant: true,
    },
    {
      title: "Protocol Health",
      body: "TVL history, APY trends, exploit timelines, and live health metrics for every major DeFi protocol.",
      tone: "bg-coral",
      icon: <Shield className="h-6 w-6" />,
    },
  ];

  return (
    <section id="features" className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-px overflow-hidden bg-outline sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, delay: i * 0.08 }}
            className={`min-h-[220px] px-7 py-7 ${f.tone} ${
              f.giant
                ? "flex flex-col justify-between"
                : "flex flex-col justify-between bg-surface-low"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-btn/65">
                {f.title}
              </div>
              {f.icon}
            </div>

            {f.giant ? (
              <>
                <div className="text-[72px] font-black leading-none tracking-[-0.08em] text-on-surface">
                  10K+
                </div>
                <p className="max-w-[240px] text-[15px] leading-6 text-on-surface">{f.body}</p>
              </>
            ) : (
              <p className="max-w-[240px] text-[24px] font-bold leading-[1.05] tracking-[-0.04em] text-on-surface">
                {f.body}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="how" className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65 }}
        >
          <div className="mb-10">
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-on-surface-variant/70">
              How it works
            </div>
            <h2 className="max-w-[520px] text-[44px] font-black leading-[0.95] tracking-[-0.06em] text-on-surface md:text-[64px]">
              Increase your yield by investing with{" "}
              <span className="text-accent">intelligence</span>
            </h2>
          </div>

          <Link
            href="/scanner"
            className="inline-flex items-center gap-3 border border-btn px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-btn transition-all hover:-translate-y-0.5 hover:bg-btn hover:text-white"
          >
            Try the Scanner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="space-y-4">
          {[
            {
              step: "01",
              title: "Set Your Parameters",
              desc: "Define budget, risk appetite, preferred chains, and target APY range. The scanner adapts to your exact profile.",
              icon: <Lock className="h-5 w-5 text-accent" />,
            },
            {
              step: "02",
              title: "AI Scans & Analyzes",
              desc: "Our engine queries DeFiLlama for all matching pools, then Claude Opus deep-analyzes the top 30 protocols for safety.",
              icon: <Brain className="h-5 w-5 text-cta" />,
            },
            {
              step: "03",
              title: "Review & Invest",
              desc: "Get a risk-adjusted allocation with legitimacy scores, red flags, and step-by-step instructions. Export as PDF.",
              icon: <TrendingUp className="h-5 w-5 text-accent" />,
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group flex items-start gap-6 border border-outline bg-surface-low p-8 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_12px_32px_rgba(0,212,170,0.06)]"
            >
              <span className="text-[38px] font-black tracking-[-0.06em] text-on-surface/10 group-hover:text-accent/30 transition-colors">
                {item.step}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {item.icon}
                  <h4 className="text-[20px] font-bold tracking-[-0.03em] text-on-surface">{item.title}</h4>
                </div>
                <p className="text-[14px] leading-[1.6] text-on-surface-variant">{item.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-on-surface/10 group-hover:text-accent/50 transition-all group-hover:translate-x-1" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats: [string, string, string][] = [
    ["10K+", "Yield pools", "scanned in real-time"],
    ["120+", "Blockchain networks", "supported"],
    ["3K+", "Protocols analyzed", "by Claude AI"],
  ];

  return (
    <section id="stats" className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <motion.article
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.7 }}
        className="overflow-hidden border border-outline bg-surface-low"
      >
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-between p-7 md:p-10 lg:p-12">
            <div>
              <SectionLabel>Intelligence at Scale</SectionLabel>
              <h3 className="max-w-[620px] text-[34px] font-black leading-[0.97] tracking-[-0.05em] text-on-surface md:text-[52px]">
                Deep protocol research that institutional investors demand, available to everyone.
              </h3>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 border-t border-outline pt-7 md:grid-cols-3">
              {stats.map(([value, line1, line2]) => (
                <div key={value}>
                  <div className="text-[42px] font-black leading-none tracking-[-0.07em] text-on-surface md:text-[54px]">
                    {value}
                  </div>
                  <div className="mt-3 text-[15px] leading-6 text-on-surface-variant">
                    <div>{line1}</div>
                    <div>{line2}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden bg-[#0a1022] lg:min-h-[520px]">
            {/* Abstract visual */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="h-[300px] w-[300px] bg-accent/20 blur-[100px]"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 5, repeat: Infinity }}
              />
            </div>
            <div className="relative z-10 flex h-full flex-col items-center justify-center p-10 text-center">
              <div className="text-[72px] font-black tracking-[-0.06em] text-white md:text-[96px]">
                92<span className="text-accent">/100</span>
              </div>
              <div className="mt-2 text-[14px] font-semibold uppercase tracking-[0.2em] text-white/60">
                Average Protocol Safety Score
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </section>
  );
}

function ToolsShowcase() {
  const tools = [
    { name: "Yield Scanner", desc: "Real-time pool scanning with filters", href: "/scanner", color: "bg-accent" },
    { name: "AI Strategy", desc: "Budget-based AI portfolio allocation", href: "/strategy", color: "bg-cta" },
    { name: "Risk Lab", desc: "VaR, Sharpe ratio, stress tests", href: "/risk", color: "bg-coral" },
    { name: "Protocol Health", desc: "TVL trends, exploit history, audits", href: "/health", color: "bg-lime" },
    { name: "Portfolio Monitor", desc: "Live alerts for APY & TVL changes", href: "/monitor", color: "bg-cyan" },
    { name: "Multi-Strategy", desc: "Compare 3 risk profiles side by side", href: "/compare", color: "bg-accent" },
  ];

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
      >
        <SectionLabel>All Tools Included</SectionLabel>
        <h3 className="mb-12 max-w-[620px] text-[38px] font-black leading-[0.95] tracking-[-0.05em] text-on-surface md:text-[56px]">
          Everything you need to invest in DeFi with confidence.
        </h3>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, i) => (
          <motion.div
            key={tool.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
          >
            <Link
              href={tool.href}
              className="group flex flex-col justify-between border border-outline bg-surface-low p-8 min-h-[180px] transition-all hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_12px_32px_rgba(0,212,170,0.06)]"
            >
              <div>
                <div className={`mb-4 h-2 w-8 ${tool.color}`} />
                <h4 className="text-[22px] font-bold tracking-[-0.03em] text-on-surface">
                  {tool.name}
                </h4>
                <p className="mt-2 text-[14px] text-muted">{tool.desc}</p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em] text-btn/60 group-hover:text-accent">
                Open
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
        className="grid grid-cols-1 gap-8 border border-outline bg-surface-low p-8 md:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:p-14"
      >
        <div>
          <SectionLabel>Start now</SectionLabel>
          <h3 className="max-w-[520px] text-[38px] font-black leading-[0.95] tracking-[-0.05em] text-on-surface md:text-[56px]">
            Stop guessing. Start investing with{" "}
            <span className="text-accent">intelligence.</span>
          </h3>
        </div>

        <div className="flex flex-col justify-end gap-6">
          <p className="text-[16px] leading-[1.6] text-on-surface-variant">
            No wallet connection. No signup. No fees. Just powerful DeFi analysis tools
            backed by Claude AI and DeFiLlama data.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/scanner"
              className="bg-cta px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(255,108,18,0.28)]"
            >
              Launch Scanner
            </Link>
            <Link
              href="/strategy"
              className="border border-btn px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.08em] text-btn transition-all hover:-translate-y-0.5 hover:bg-btn hover:text-white"
            >
              Try AI Strategy
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <section id="contact" className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.7 }}
        className="border-t border-outline pt-12"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SectionLabel>Ready to get started?</SectionLabel>
            <h2 className="max-w-[760px] text-[44px] font-black leading-[0.93] tracking-[-0.06em] text-on-surface md:text-[72px]">
              Invest smarter.
              <br />
              <span className="text-accent">Analyze deeper.</span>
              <br />
              Let&apos;s go.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <div>
              <SectionLabel>Platform</SectionLabel>
              <div className="space-y-3 text-[16px] text-on-surface-variant">
                <Link className="block hover:opacity-60 transition-opacity" href="/scanner">Scanner</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/strategy">AI Strategy</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/risk">Risk Lab</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/health">Protocol Health</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/monitor">Monitor</Link>
              </div>
            </div>

            <div>
              <SectionLabel>Data Sources</SectionLabel>
              <div className="space-y-4 text-[16px] text-on-surface-variant">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4" />
                  <span>DeFiLlama API</span>
                </div>
                <div className="flex items-center gap-3">
                  <Brain className="h-4 w-4" />
                  <span>Claude Opus 4.6 AI</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4" />
                  <span>contact@sovereign.fi</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-outline pt-6 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
          <p>Sovereign Investment Group — Institutional DeFi intelligence for everyone.</p>
          <p>2025 Sovereign Investment Group. All rights reserved.</p>
        </div>
      </motion.div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-cta selection:text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[8%] h-[280px] w-[280px] rounded-full bg-surface-highest/35 blur-[80px]" />
        <div className="absolute right-[-8%] top-[18%] h-[320px] w-[320px] rounded-full bg-surface-highest/30 blur-[95px]" />
        <div className="absolute bottom-[10%] left-[20%] h-[220px] w-[220px] rounded-full bg-surface-highest/20 blur-[85px]" />
      </div>

      <div className="relative">
        <Header />
        <Hero />
        <FeaturesStrip />
        <ProductSection />
        <StatsSection />
        <ToolsShowcase />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
