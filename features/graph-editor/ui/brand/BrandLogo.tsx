export function BrandLogo({ size }: { size: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <img
        src="/brand/graph-editor-logo.webp"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="ge-brand-light object-contain select-none"
        style={{ width: size, height: size }}
        draggable={false}
      />
      <img
        src="/brand/graph-editor-logo-dark.webp"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="ge-brand-dark object-contain select-none"
        style={{ width: size, height: size }}
        draggable={false}
      />
    </span>
  );
}
