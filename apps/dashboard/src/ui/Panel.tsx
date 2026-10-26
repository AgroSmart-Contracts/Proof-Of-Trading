import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Shared white bordered surface and its uppercase title. Mirrors
 * trumarket/web components/common/panel (Panel, SectionLabel).
 */
export function Panel({
  children,
  className,
  as: Comp = "section",
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  /** Softer muted / dashed empty-state shell. */
  muted?: boolean;
}) {
  return <Comp className={cx("tm-ui-panel", muted && "tm-ui-panel--muted", className)}>{children}</Comp>;
}

export function SectionLabel({
  children,
  className,
  as: Comp = "h3",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p" | "span";
}) {
  return <Comp className={cx("tm-ui-section-label", className)}>{children}</Comp>;
}
