import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "./cx";

/**
 * Text input and select with the web's form-control styling
 * (trumarket/web lib/form-control-styles.ts): 42px tall, rounded-xl,
 * green focus border with a soft ring, 2px red border when invalid.
 */
type FieldChrome = { label?: ReactNode; error?: ReactNode; invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldChrome>(
  function Input({ label, error, invalid, className, id, ...rest }, ref) {
    const auto = useId();
    const inputId = id ?? auto;
    const bad = invalid || Boolean(error);
    const control = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={bad || undefined}
        className={cx("tm-control", bad && "tm-control--invalid", className)}
        {...rest}
      />
    );
    if (!label && !error) return control;
    return (
      <div className="tm-field">
        {label && <label className="tm-field__label" htmlFor={inputId}>{label}</label>}
        {control}
        {error && <span className="tm-field__error">{error}</span>}
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldChrome>(
  function Select({ label, error, invalid, className, id, children, ...rest }, ref) {
    const auto = useId();
    const selectId = id ?? auto;
    const bad = invalid || Boolean(error);
    const control = (
      <select
        ref={ref}
        id={selectId}
        aria-invalid={bad || undefined}
        className={cx("tm-control", bad && "tm-control--invalid", className)}
        {...rest}
      >
        {children}
      </select>
    );
    if (!label && !error) return control;
    return (
      <div className="tm-field">
        {label && <label className="tm-field__label" htmlFor={selectId}>{label}</label>}
        {control}
        {error && <span className="tm-field__error">{error}</span>}
      </div>
    );
  },
);
