import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvestmentStrategy } from "@/types/strategy";

const COLORS = {
  bg: [236, 236, 239] as [number, number, number],
  surface: [242, 243, 245] as [number, number, number],
  primary: [0, 212, 170] as [number, number, number],
  text: [32, 50, 65] as [number, number, number],
  textDim: [107, 119, 129] as [number, number, number],
  error: [255, 77, 77] as [number, number, number],
  green: [0, 212, 170] as [number, number, number],
};

export function generateStrategyPDF(
  strategy: InvestmentStrategy,
  criteria?: { budget: number; riskAppetite: string }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ===== PAGE 1: COVER =====
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Border accent
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 4, pageHeight, "F");

  // Title
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.text("SOVEREIGN TERMINAL", margin, 40);

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(36);
  doc.text("Investment", margin, 70);
  doc.setFontSize(36);
  doc.setTextColor(...COLORS.primary);
  doc.text("Strategy Report", margin, 85);

  doc.setTextColor(...COLORS.textDim);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date(strategy.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 105);

  if (criteria) {
    doc.text(`Budget: $${criteria.budget.toLocaleString()}`, margin, 115);
    doc.text(`Risk Profile: ${criteria.riskAppetite.charAt(0).toUpperCase() + criteria.riskAppetite.slice(1)}`, margin, 125);
  }

  doc.text(`Projected APY: ${strategy.projectedApy.toFixed(2)}%`, margin, 140);
  doc.text(`Projected Yearly Return: $${strategy.projectedYearlyReturn.toLocaleString()}`, margin, 150);
  doc.text(`Allocations: ${strategy.allocations.length} positions`, margin, 160);

  // ===== PAGE 2: EXECUTIVE SUMMARY =====
  doc.addPage();
  drawPageBg(doc, pageWidth, pageHeight);

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.text("EXECUTIVE SUMMARY", margin, 20);

  doc.setFontSize(20);
  doc.setTextColor(...COLORS.text);
  doc.text("Strategy Overview", margin, 32);

  doc.setTextColor(...COLORS.textDim);
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(strategy.summary, contentWidth);
  doc.text(summaryLines, margin, 45);

  let yPos = 45 + summaryLines.length * 5 + 15;

  // Key metrics
  doc.setFillColor(...COLORS.surface);
  doc.rect(margin, yPos, contentWidth, 25, "F");

  const metricWidth = contentWidth / 4;
  const metrics = [
    { label: "PROJECTED APY", value: `${strategy.projectedApy.toFixed(2)}%` },
    { label: "YEARLY RETURN", value: `$${strategy.projectedYearlyReturn.toLocaleString()}` },
    { label: "ALLOCATIONS", value: `${strategy.allocations.length}` },
    { label: "AVG SAFETY", value: `${(strategy.allocations.reduce((s, a) => s + (a.legitimacyScore || 0), 0) / Math.max(strategy.allocations.length, 1)).toFixed(0)}/100` },
  ];

  metrics.forEach((m, i) => {
    const x = margin + i * metricWidth + 5;
    doc.setTextColor(...COLORS.textDim);
    doc.setFontSize(6);
    doc.text(m.label, x, yPos + 8);
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.text(m.value, x, yPos + 18);
  });

  // ===== PAGE 3: ALLOCATIONS TABLE =====
  doc.addPage();
  drawPageBg(doc, pageWidth, pageHeight);

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.text("PORTFOLIO ALLOCATIONS", margin, 20);

  doc.setFontSize(20);
  doc.setTextColor(...COLORS.text);
  doc.text("Allocation Details", margin, 32);

  const tableData = strategy.allocations.map((a, i) => [
    String(i + 1),
    a.protocol,
    a.symbol,
    a.chain,
    `${a.apy.toFixed(2)}%`,
    `$${a.allocationAmount.toLocaleString()}`,
    `${a.allocationPercent}%`,
    `${a.legitimacyScore || "N/A"}`,
    (a.verdict || "N/A").replace("_", " "),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["#", "Protocol", "Symbol", "Chain", "APY", "Amount", "%", "Safety", "Verdict"]],
    body: tableData,
    theme: "plain",
    styles: {
      fillColor: COLORS.surface,
      textColor: COLORS.textDim,
      fontSize: 7,
      cellPadding: 3,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: COLORS.primary,
      fontSize: 6,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [20, 20, 20],
    },
    margin: { left: margin, right: margin },
  });

  // ===== PAGE 4: RISK + DIVERSIFICATION =====
  doc.addPage();
  drawPageBg(doc, pageWidth, pageHeight);

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.text("RISK ANALYSIS", margin, 20);

  doc.setFontSize(16);
  doc.setTextColor(...COLORS.text);
  doc.text("Risk Assessment", margin, 32);

  doc.setTextColor(...COLORS.textDim);
  doc.setFontSize(9);
  const riskLines = doc.splitTextToSize(strategy.riskAssessment, contentWidth);
  doc.text(riskLines, margin, 42);

  yPos = 42 + riskLines.length * 5 + 10;

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.text("DIVERSIFICATION", margin, yPos);

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(16);
  doc.text("Portfolio Diversification", margin, yPos + 12);

  doc.setTextColor(...COLORS.textDim);
  doc.setFontSize(9);
  const divLines = doc.splitTextToSize(strategy.diversificationNotes, contentWidth);
  doc.text(divLines, margin, yPos + 22);

  // ===== PAGE 5: STEPS + WARNINGS =====
  doc.addPage();
  drawPageBg(doc, pageWidth, pageHeight);

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.text("IMPLEMENTATION", margin, 20);

  doc.setFontSize(16);
  doc.setTextColor(...COLORS.text);
  doc.text("Step-by-Step Instructions", margin, 32);

  yPos = 42;
  strategy.steps.forEach((step, i) => {
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.text(`${i + 1}`, margin, yPos);

    doc.setTextColor(...COLORS.textDim);
    doc.setFontSize(8);
    const stepLines = doc.splitTextToSize(step, contentWidth - 15);
    doc.text(stepLines, margin + 12, yPos);
    yPos += stepLines.length * 5 + 5;

    if (yPos > pageHeight - 40) {
      doc.addPage();
      drawPageBg(doc, pageWidth, pageHeight);
      yPos = 20;
    }
  });

  // Warnings
  if (strategy.warnings.length > 0) {
    yPos += 10;
    if (yPos > pageHeight - 60) {
      doc.addPage();
      drawPageBg(doc, pageWidth, pageHeight);
      yPos = 20;
    }

    doc.setFillColor(...COLORS.error);
    doc.rect(margin, yPos - 5, 3, strategy.warnings.length * 12 + 5, "F");

    doc.setTextColor(...COLORS.error);
    doc.setFontSize(8);
    doc.text("WARNINGS", margin + 8, yPos);
    yPos += 8;

    strategy.warnings.forEach((w) => {
      doc.setTextColor(...COLORS.textDim);
      doc.setFontSize(8);
      const wLines = doc.splitTextToSize(`⚠ ${w}`, contentWidth - 15);
      doc.text(wLines, margin + 8, yPos);
      yPos += wLines.length * 5 + 3;
    });
  }

  // ===== DISCLAIMER (LAST PAGE) =====
  yPos += 15;
  if (yPos > pageHeight - 30) {
    doc.addPage();
    drawPageBg(doc, pageWidth, pageHeight);
    yPos = 20;
  }

  doc.setFillColor(...COLORS.surface);
  doc.rect(margin, yPos, contentWidth, 20, "F");
  doc.setTextColor(...COLORS.textDim);
  doc.setFontSize(6);
  doc.text(
    "DISCLAIMER: This strategy is AI-generated and for informational purposes only. Not financial advice. Always do your own research before investing.",
    margin + 5, yPos + 8
  );
  doc.text("Generated by Sovereign Terminal — Powered by DeFiLlama + Claude AI", margin + 5, yPos + 14);

  // Save
  doc.save(`sovereign-strategy-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function drawPageBg(doc: jsPDF, width: number, height: number) {
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, width, height, "F");
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 4, height, "F");
}
