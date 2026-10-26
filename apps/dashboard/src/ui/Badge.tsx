import type { ReactNode } from "react";
import { cx } from "./cx";

/** Pill status label, the web's `.tm-badge` classes. */
export function Badge({
  children,
  tone = "primary",
  outline = false,
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "accent" | "danger" | "info";
  outline?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("tm-badge", `tm-badge-${tone}`, outline && "tm-badge-outline", className)}>{children}</span>
  );
}
