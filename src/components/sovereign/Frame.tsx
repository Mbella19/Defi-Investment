import type { CSSProperties, ReactNode } from "react";

type FrameProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: number | string;
};

export function Frame({ children, className = "", style, padding = 24 }: FrameProps) {
  return (
    <div
      className={`brackets ${className}`}
      style={{
        padding,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Frame;
