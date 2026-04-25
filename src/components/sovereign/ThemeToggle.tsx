"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Icons } from "./Icons";

type Variant = "desktop" | "mobile";

type Props = {
  variant?: Variant;
};

export function ThemeToggle({ variant = "desktop" }: Props) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className="m-icon-btn"
      >
        {isDark ? <Icons.sun size={18} /> : <Icons.moon size={18} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        color: "var(--text-2)",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {isDark ? <Icons.sun size={15} /> : <Icons.moon size={15} />}
    </button>
  );
}

export default ThemeToggle;
