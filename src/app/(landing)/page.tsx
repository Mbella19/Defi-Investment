"use client";

import React from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import Link from "next/link";

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
    <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
      {children}
    </div>
  );
}

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-6 pb-8 pt-8 lg:px-10">
      <div className="flex items-center gap-2">
        <div className="text-[36px] font-black leading-[0.85] tracking-[-0.08em] text-[#203241]">
          ST
        </div>
        <div className="pt-0.5 text-[10px] font-medium uppercase leading-[1.1] tracking-[0.02em] text-[#203241]">
          <div>Sovereign</div>
          <div>Terminal</div>
        </div>
      </div>

      <nav className="hidden items-center gap-12 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#2a3a46] md:flex">
        <a className="transition-opacity hover:opacity-60" href="#features">Features</a>
        <a className="transition-opacity hover:opacity-60" href="#how">How it works</a>
        <a className="transition-opacity hover:opacity-60" href="#stats">Intelligence</a>
        <a className="transition-opacity hover:opacity-60" href="#contact">Contact</a>
      </nav>

      <Link
        href="/scanner"
        className="border border-[#2a3a46] px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#2a3a46] transition-all hover:-translate-y-0.5 hover:bg-[#2a3a46] hover:text-white"
      >
        Launch App
      </Link>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-6 pb-16 lg:px-10">
      <div className="grid min-h-[680px] grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-0">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col justify-center pt-10 lg:pt-0"
        >
          <h1 className="max-w-[520px] text-[56px] font-black leading-[0.93] tracking-[-0.06em] text-[#203241] md:text-[80px] lg:text-[88px]">
            The Investment Platform for{" "}
            <span className="text-[#00D4AA]">DeFi</span>
          </h1>

          <p className="mt-8 max-w-[440px] text-[16px] leading-[1.6] text-[#43515d]">
            Institutional-grade yield analysis powered by AI. Scan 10,000+ pools,
            deep-analyze protocol legitimacy, and build risk-adjusted strategies
            — all in one terminal.
          </p>

          <div className="mt-12 w-full max-w-[480px] border-t border-[#2e3943] pt-7">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[22px] font-semibold tracking-[-0.04em] text-[#2a3a46] md:text-[28px]">
                Free to use. No wallet needed.
              </div>
              <Link
                href="/scanner"
                className="min-w-[156px] bg-[#ff6c12] px-8 py-4 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(255,108,18,0.28)]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Hero visual — abstract shapes */}
        <div className="relative min-h-[480px] overflow-hidden lg:min-h-[680px]">
          {/* Glowing orbs */}
          <motion.div
            className="absolute left-[15%] top-[10%] h-[280px] w-[280px] bg-[#00D4AA]/20 blur-[80px]"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-[10%] top-[30%] h-[200px] w-[200px] bg-[#ff6c12]/15 blur-[70px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />

          {/* Floating cards */}
          <motion.div
            className="absolute left-[8%] top-[18%] z-10 w-[260px] border border-[#d7dade] bg-white p-6 shadow-[0_24px_48px_rgba(32,50,65,0.08)]"
            animate={{ y: [0, -12, 0], rotate: [0, 0.5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#45515d]/60">
              Projected APY
            </div>
            <div className="mt-2 text-[42px] font-black tracking-[-0.06em] text-[#00D4AA]">
              12.4%
            </div>
            <div className="mt-3 flex gap-3">
              <span className="bg-[#00D4AA]/10 px-2 py-1 text-[10px] font-semibold text-[#00D4AA]">
                LOW RISK
              </span>
              <span className="bg-[#f2f3f5] px-2 py-1 text-[10px] font-semibold text-[#43515d]">
                5 POOLS
              </span>
            </div>
          </motion.div>

          <motion.div
            className="absolute right-[5%] top-[12%] z-20 w-[220px] border border-[#d7dade] bg-white p-5 shadow-[0_24px_48px_rgba(32,50,65,0.08)]"
            animate={{ y: [0, 10, 0], x: [0, -4, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#45515d]/60">
              AI Verdict
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#00D4AA]" />
              <span className="text-[18px] font-bold text-[#203241]">High Confidence</span>
            </div>
            <div className="mt-2 text-[12px] text-[#6b7781]">Score: 92/100</div>
          </motion.div>

          <motion.div
            className="absolute bottom-[15%] left-[20%] z-10 w-[240px] border border-[#d7dade] bg-white p-5 shadow-[0_24px_48px_rgba(32,50,65,0.08)]"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#45515d]/60">
              Portfolio Alert
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#ff6c12]" />
              <span className="text-[14px] font-bold text-[#203241]">APY up +3.2%</span>
            </div>
            <div className="mt-1 text-[11px] text-[#6b7781]">Aave V3 on Ethereum</div>
          </motion.div>

          {/* Bottom-right text block */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.3 }}
            className="absolute bottom-[6%] right-[4%] z-30 max-w-[200px]"
          >
            <h3 className="text-[36px] font-black leading-[0.95] tracking-[-0.05em] text-[#203241] md:text-[44px]">
              Smarter yields start here.
            </h3>
            <Link
              href="#how"
              className="mt-5 inline-flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2a3a46]/80 hover:text-[#2a3a46]"
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
      tone: "bg-[#00D4AA]",
      icon: <BarChart3 className="h-6 w-6" />,
    },
    {
      title: "Yield Scanner",
      body: "Scan 10,000+ yield pools across 120+ chains in real-time. Filter by APY, TVL, risk, and asset type instantly.",
      tone: "bg-[#dce61a]",
      icon: <TrendingUp className="h-6 w-6" />,
      giant: true,
    },
    {
      title: "Protocol Health",
      body: "TVL history, APY trends, exploit timelines, and live health metrics for every major DeFi protocol.",
      tone: "bg-[#ff6887]",
      icon: <Shield className="h-6 w-6" />,
    },
  ];

  return (
    <section id="features" className="mx-auto w-full max-w-[1320px] px-6 py-6 lg:px-10">
      <div className="grid grid-cols-1 gap-px overflow-hidden bg-[#d7d8dc] md:grid-cols-4">
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
                : "flex flex-col justify-between bg-[#eeeff1]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2a3a46]/65">
                {f.title}
              </div>
              {f.icon}
            </div>

            {f.giant ? (
              <>
                <div className="text-[72px] font-black leading-none tracking-[-0.08em] text-[#1b2430]">
                  10K+
                </div>
                <p className="max-w-[240px] text-[15px] leading-6 text-[#1d2933]">{f.body}</p>
              </>
            ) : (
              <p className="max-w-[240px] text-[24px] font-bold leading-[1.05] tracking-[-0.04em] text-[#1f2d39]">
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
    <section id="how" className="mx-auto w-full max-w-[1320px] px-6 py-24 lg:px-10">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65 }}
        >
          <div className="mb-10">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.24em] text-[#43515d]/70">
              How it works
            </div>
            <h2 className="max-w-[520px] text-[44px] font-black leading-[0.95] tracking-[-0.06em] text-[#203241] md:text-[64px]">
              Increase your yield by investing with{" "}
              <span className="text-[#00D4AA]">intelligence</span>
            </h2>
          </div>

          <Link
            href="/scanner"
            className="inline-flex items-center gap-3 border border-[#2a3a46] px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#2a3a46] transition-all hover:-translate-y-0.5 hover:bg-[#2a3a46] hover:text-white"
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
              icon: <Lock className="h-5 w-5 text-[#00D4AA]" />,
            },
            {
              step: "02",
              title: "AI Scans & Analyzes",
              desc: "Our engine queries DeFiLlama for all matching pools, then Claude Opus deep-analyzes the top 30 protocols for safety.",
              icon: <Brain className="h-5 w-5 text-[#ff6c12]" />,
            },
            {
              step: "03",
              title: "Review & Invest",
              desc: "Get a risk-adjusted allocation with legitimacy scores, red flags, and step-by-step instructions. Export as PDF.",
              icon: <TrendingUp className="h-5 w-5 text-[#00D4AA]" />,
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group flex items-start gap-6 border border-[#d7dade] bg-[#f2f3f5] p-8 transition-all hover:-translate-y-0.5 hover:border-[#00D4AA]/30 hover:shadow-[0_12px_32px_rgba(0,212,170,0.06)]"
            >
              <span className="text-[38px] font-black tracking-[-0.06em] text-[#203241]/10 group-hover:text-[#00D4AA]/30 transition-colors">
                {item.step}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {item.icon}
                  <h4 className="text-[20px] font-bold tracking-[-0.03em] text-[#203241]">{item.title}</h4>
                </div>
                <p className="text-[14px] leading-[1.6] text-[#43515d]">{item.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#203241]/10 group-hover:text-[#00D4AA]/50 transition-all group-hover:translate-x-1" />
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
    <section id="stats" className="mx-auto w-full max-w-[1320px] px-6 py-8 lg:px-10">
      <motion.article
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.7 }}
        className="overflow-hidden border border-[#d8dade] bg-[#f2f3f5]"
      >
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-between p-7 md:p-10 lg:p-12">
            <div>
              <SectionLabel>Intelligence at Scale</SectionLabel>
              <h3 className="max-w-[620px] text-[34px] font-black leading-[0.97] tracking-[-0.05em] text-[#203241] md:text-[52px]">
                Deep protocol research that institutional investors demand, available to everyone.
              </h3>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 border-t border-[#d7dade] pt-7 md:grid-cols-3">
              {stats.map(([value, line1, line2]) => (
                <div key={value}>
                  <div className="text-[42px] font-black leading-none tracking-[-0.07em] text-[#203241] md:text-[54px]">
                    {value}
                  </div>
                  <div className="mt-3 text-[15px] leading-6 text-[#43515d]">
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
                className="h-[300px] w-[300px] bg-[#00D4AA]/20 blur-[100px]"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 5, repeat: Infinity }}
              />
            </div>
            <div className="relative z-10 flex h-full flex-col items-center justify-center p-10 text-center">
              <div className="text-[72px] font-black tracking-[-0.06em] text-white md:text-[96px]">
                92<span className="text-[#00D4AA]">/100</span>
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
    { name: "Yield Scanner", desc: "Real-time pool scanning with filters", href: "/scanner", color: "bg-[#00D4AA]" },
    { name: "AI Strategy", desc: "Budget-based AI portfolio allocation", href: "/strategy", color: "bg-[#ff6c12]" },
    { name: "Risk Lab", desc: "VaR, Sharpe ratio, stress tests", href: "/risk", color: "bg-[#ff6887]" },
    { name: "Protocol Health", desc: "TVL trends, exploit history, audits", href: "/health", color: "bg-[#dce61a]" },
    { name: "Portfolio Monitor", desc: "Live alerts for APY & TVL changes", href: "/monitor", color: "bg-[#49c7c8]" },
    { name: "Multi-Strategy", desc: "Compare 3 risk profiles side by side", href: "/compare", color: "bg-[#00D4AA]" },
  ];

  return (
    <section className="mx-auto w-full max-w-[1320px] px-6 py-24 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
      >
        <SectionLabel>All Tools Included</SectionLabel>
        <h3 className="mb-12 max-w-[620px] text-[38px] font-black leading-[0.95] tracking-[-0.05em] text-[#203241] md:text-[56px]">
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
              className="group flex flex-col justify-between border border-[#d7dade] bg-[#f2f3f5] p-8 min-h-[180px] transition-all hover:-translate-y-1 hover:border-[#00D4AA]/30 hover:shadow-[0_12px_32px_rgba(0,212,170,0.06)]"
            >
              <div>
                <div className={`mb-4 h-2 w-8 ${tool.color}`} />
                <h4 className="text-[22px] font-bold tracking-[-0.03em] text-[#203241]">
                  {tool.name}
                </h4>
                <p className="mt-2 text-[14px] text-[#6b7781]">{tool.desc}</p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2a3a46]/60 group-hover:text-[#00D4AA]">
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
    <section className="mx-auto w-full max-w-[1320px] px-6 py-24 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
        className="grid grid-cols-1 gap-8 border border-[#d7dade] bg-[#f2f3f5] p-8 md:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:p-14"
      >
        <div>
          <SectionLabel>Start now</SectionLabel>
          <h3 className="max-w-[520px] text-[38px] font-black leading-[0.95] tracking-[-0.05em] text-[#203241] md:text-[56px]">
            Stop guessing. Start investing with{" "}
            <span className="text-[#00D4AA]">intelligence.</span>
          </h3>
        </div>

        <div className="flex flex-col justify-end gap-6">
          <p className="text-[16px] leading-[1.6] text-[#43515d]">
            No wallet connection. No signup. No fees. Just powerful DeFi analysis tools
            backed by Claude AI and DeFiLlama data.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/scanner"
              className="bg-[#ff6c12] px-8 py-4 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(255,108,18,0.28)]"
            >
              Launch Scanner
            </Link>
            <Link
              href="/strategy"
              className="border border-[#2a3a46] px-8 py-4 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-[#2a3a46] transition-all hover:-translate-y-0.5 hover:bg-[#2a3a46] hover:text-white"
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
    <section id="contact" className="mx-auto w-full max-w-[1320px] px-6 pb-16 pt-10 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.7 }}
        className="border-t border-[#d4d7db] pt-12"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SectionLabel>Ready to get started?</SectionLabel>
            <h2 className="max-w-[760px] text-[44px] font-black leading-[0.93] tracking-[-0.06em] text-[#203241] md:text-[72px]">
              Invest smarter.
              <br />
              <span className="text-[#00D4AA]">Analyze deeper.</span>
              <br />
              Let&apos;s go.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <div>
              <SectionLabel>Platform</SectionLabel>
              <div className="space-y-3 text-[16px] text-[#2c3b46]">
                <Link className="block hover:opacity-60 transition-opacity" href="/scanner">Scanner</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/strategy">AI Strategy</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/risk">Risk Lab</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/health">Protocol Health</Link>
                <Link className="block hover:opacity-60 transition-opacity" href="/monitor">Monitor</Link>
              </div>
            </div>

            <div>
              <SectionLabel>Data Sources</SectionLabel>
              <div className="space-y-4 text-[16px] text-[#2c3b46]">
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

        <div className="mt-16 flex flex-col gap-4 border-t border-[#d4d7db] pt-6 text-[13px] text-[#5f6d77] md:flex-row md:items-center md:justify-between">
          <p>Sovereign Terminal — Institutional DeFi intelligence for everyone.</p>
          <p>2025 Sovereign Terminal. All rights reserved.</p>
        </div>
      </motion.div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#ececef] text-[#203241] selection:bg-[#ff6c12] selection:text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[8%] h-[280px] w-[280px] rounded-full bg-white/35 blur-[80px]" />
        <div className="absolute right-[-8%] top-[18%] h-[320px] w-[320px] rounded-full bg-white/30 blur-[95px]" />
        <div className="absolute bottom-[10%] left-[20%] h-[220px] w-[220px] rounded-full bg-white/20 blur-[85px]" />
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
