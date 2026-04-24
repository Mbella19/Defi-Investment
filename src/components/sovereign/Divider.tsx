type DividerProps = {
  vertical?: boolean;
  className?: string;
};

export function Divider({ vertical = false, className = "" }: DividerProps) {
  if (vertical) {
    return (
      <div
        className={className}
        style={{
          width: 1,
          alignSelf: "stretch",
          background:
            "repeating-linear-gradient(to bottom, var(--line) 0 4px, transparent 4px 8px)",
        }}
      />
    );
  }
  return (
    <div
      className={className}
      style={{
        height: 1,
        width: "100%",
        background:
          "repeating-linear-gradient(to right, var(--line) 0 6px, transparent 6px 12px)",
      }}
    />
  );
}

export default Divider;
