import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Loading } from "./Loading";

/**
 * Canonical action button. Same variants, sizes and props as
 * trumarket/web components/common/button (PRIMARY / SECONDARY first).
 */
export enum ButtonVariants {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  ACCENT = "accent",
  DANGER = "danger",
  GHOST = "ghost",
}

export enum ButtonSizes {
  SM = "sm",
  MD = "md",
  LG = "lg",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariants;
  size?: ButtonSizes;
  loading?: boolean;
  icon?: ReactNode;
  classOverrides?: string;
}

export function Button({
  children,
  variant = ButtonVariants.PRIMARY,
  size = ButtonSizes.MD,
  loading = false,
  icon,
  classOverrides,
  className,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx("tm-button", `tm-button--${variant}`, `tm-button--${size}`, classOverrides, className)}
      {...rest}
    >
      {loading ? <Loading variant="inline" /> : icon}
      {children}
    </button>
  );
}
