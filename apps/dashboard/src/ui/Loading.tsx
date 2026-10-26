import { cx } from "./cx";

/** Spinner. Mirrors trumarket/web components/common/loading. */
export function Loading({
  variant = "page",
  label = "Loading",
  className,
}: {
  /** `inline` for buttons and compact UI; `page` centres a large spinner. */
  variant?: "page" | "inline";
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" aria-label={label} className={cx("tm-loading", `tm-loading--${variant}`, className)}>
      <span className="tm-loading__spinner" aria-hidden />
    </span>
  );
}
