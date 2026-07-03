export function LensLoader({ light }: { light?: boolean }) {
  return <span className={`lens-loader ${light ? "light" : ""}`} role="status" aria-label="Loading" />;
}
