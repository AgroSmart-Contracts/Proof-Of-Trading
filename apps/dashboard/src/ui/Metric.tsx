import type { ReactNode } from "react";
import { cx } from "./cx";

/** Big number with an uppercase caption, the web's `.tm-metric-*` classes. */
export function MetricCard({ value, label, className }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={cx("tm-metric-card", className)}>
      <div className="tm-metric-value">{value}</div>
      <div className="tm-metric-label">{label}</div>
    </div>
  );
}

/** Rounded progress bar, the web's `.tm-progress` classes. `value` is 0 to 100. */
export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={cx("tm-progress", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <div className="tm-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
