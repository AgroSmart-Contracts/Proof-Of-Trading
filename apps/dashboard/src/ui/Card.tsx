import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

/** Same variants and padding scale as trumarket/web components/common/card. */
export enum CardVariants {
  DEFAULT = "default",
  HIGHLIGHT = "highlight",
  ACCENT = "accent",
  GRADIENT_PRIMARY = "gradient_primary",
  GRADIENT_ACCENT = "gradient_accent",
}

export enum CardPadding {
  NONE = "none",
  SM = "sm",
  MD = "md",
  LG = "lg",
  XL = "xl",
}

const GRADIENT: Partial<Record<CardVariants, string>> = {
  [CardVariants.GRADIENT_PRIMARY]: "tm-gradient-primary",
  [CardVariants.GRADIENT_ACCENT]: "tm-gradient-accent",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariants;
  padding?: CardPadding;
  hover?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

export function Card({
  children,
  variant = CardVariants.DEFAULT,
  padding = CardPadding.MD,
  hover = false,
  header,
  footer,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        "tm-ui-card",
        `tm-ui-card--${variant}`,
        GRADIENT[variant],
        `tm-ui-card--pad-${padding}`,
        hover && "tm-ui-card--hover",
        className,
      )}
      {...rest}
    >
      {header && <div className="tm-ui-card__header">{header}</div>}
      <div>{children}</div>
      {footer && <div className="tm-ui-card__footer">{footer}</div>}
    </div>
  );
}
