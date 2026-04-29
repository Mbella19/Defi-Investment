export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="Sovereign">
      <span className="brand-sigil" aria-hidden="true">
        <span className="sigil-core" />
        <span className="sigil-pixel sigil-pixel-mint" />
        <span className="sigil-pixel sigil-pixel-blue" />
        <span className="sigil-pixel sigil-pixel-gold" />
      </span>
      {!compact ? (
        <span className="brand-type">
          <strong>sovereign</strong>
        </span>
      ) : null}
    </div>
  );
}
