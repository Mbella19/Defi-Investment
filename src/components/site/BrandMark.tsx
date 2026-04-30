import Image from "next/image";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`brand-lockup ${compact ? "brand-lockup-compact" : ""}`}
      aria-label="Sovereign Investment Group"
    >
      <Image
        className="brand-logo-image"
        src="/brand-assets/sovereign-investment-group-logo.png"
        alt=""
        width={1320}
        height={360}
        priority
        sizes="(max-width: 760px) 170px, 188px"
      />
    </div>
  );
}
