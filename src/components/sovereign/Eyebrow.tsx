import type { CSSProperties, ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
  color?: string;
  plain?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Eyebrow({ children, color, plain, className = "", style }: EyebrowProps) {
  const merged: CSSProperties = color
    ? ({ ...(style ?? {}), ["--accent" as never]: color } as CSSProperties)
    : (style ?? {});
  return (
    <div className={`eyebrow${plain ? " plain" : ""} ${className}`} style={merged}>
      {children}
    </div>
  );
}

export default Eyebrow;
