export function BrandLogo({
  variant = "mark",
  className = ""
}: {
  variant?: "mark" | "lockup" | "hero";
  className?: string;
}) {
  return (
    <div className={`polaris-brand polaris-brand-${variant} ${className}`.trim()}>
      <img src="/polaris-logo.png" alt="Polaris CVC" />
      {variant !== "mark" && (
        <div className="polaris-brand-copy">
          <strong>Polaris CVC</strong>
          <small>Diagnostiquer. Comprendre. Resoudre.</small>
        </div>
      )}
    </div>
  );
}

export function PolarisLoader({ label = "Chargement Polaris..." }: { label?: string }) {
  return (
    <div className="polaris-loader" aria-live="polite">
      <BrandLogo variant="mark" />
      <span />
      <strong>{label}</strong>
    </div>
  );
}
